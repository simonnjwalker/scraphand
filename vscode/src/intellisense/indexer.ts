import * as vscode from "vscode";
import * as path from "node:path";
import { BUILTINS, CommandInfo } from "./builtins";
import { scanCommands, parseDefineArg } from "./parser";

export class CommandIndex {
  private libraryCommands = new Map<string, CommandInfo>();

  clearLibrary() {
    this.libraryCommands.clear();
  }

  getCommand(name: string): CommandInfo | null {
    if (name in BUILTINS) return { name, ...BUILTINS[name] };
    return this.libraryCommands.get(name) ?? null;
  }

  listBuiltins(): CommandInfo[] {
    return Object.keys(BUILTINS).map((n) => ({ name: n, ...BUILTINS[n] }));
  }

  listLibrary(): CommandInfo[] {
    return [...this.libraryCommands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async rebuildForDocument(doc: vscode.TextDocument) {
    this.clearLibrary();

    // Collect documents to scan:
    // - the doc itself
    // - implicit companions: base.*.sh1
    // - explicit imports from any scanned doc (one hop to start; you can recurse later)
    const toScan = await collectDocsToScan(doc);

    for (const d of toScan) {
      this.indexDefinesFromTextDocument(d);
    }
  }

  private indexDefinesFromTextDocument(doc: vscode.TextDocument) {
    const commands = scanCommands(doc.getText());

    for (const c of commands) {
      if (c.name !== "define") continue;

      const info = parseDefineArg(c.arg);
      if (!info.definedName) continue;

      const pos = doc.positionAt(c.startOffset);
      const loc = new vscode.Location(doc.uri, pos);

      const documentation =
        info.doc ??
        `Defined in ${vscode.workspace.asRelativePath(doc.uri)}\n\n(Provide doc=... in {define:...} to improve IntelliSense.)`;

      this.libraryCommands.set(info.definedName, {
        name: info.definedName,
        origin: "library",
        documentation,
        argsHint: info.args,
        definedAt: loc,
      });
    }
  }
}

async function collectDocsToScan(entry: vscode.TextDocument): Promise<vscode.TextDocument[]> {
  const docs: vscode.TextDocument[] = [];
  const seen = new Set<string>();

  async function add(uri: vscode.Uri) {
    const key = uri.toString();
    if (seen.has(key)) return;
    seen.add(key);
    const d = await vscode.workspace.openTextDocument(uri);
    docs.push(d);
  }

  // always include entry doc
  await add(entry.uri);

  // add companions: base.*.sh1 in same directory
  const dir = path.dirname(entry.uri.fsPath);
  const base = path.basename(entry.uri.fsPath, path.extname(entry.uri.fsPath));
  const pattern = new vscode.RelativePattern(dir, `${base}.*.sh1`);
  const companionUris = await vscode.workspace.findFiles(pattern);

  for (const u of companionUris) await add(u);

  // explicit imports (from entry doc only for MVP)
  // If you want recursive: loop until no new URIs.
  const imports = extractImports(entry.getText());
  for (const imp of imports) {
    const resolved = resolveImport(entry.uri, imp);
    if (resolved) await add(resolved);
  }

  return docs;
}

function extractImports(text: string): string[] {
  const out: string[] = [];
  for (const c of scanCommands(text)) {
    if (c.name === "import" && c.arg) out.push(c.arg);
  }
  return out;
}

function resolveImport(from: vscode.Uri, importPath: string): vscode.Uri | null {
  const p = importPath.trim();
  if (!p) return null;

  // absolute windows or posix
  if (path.isAbsolute(p)) return vscode.Uri.file(p);

  // follow your engine rule: fileDir base
  const baseDir = path.dirname(from.fsPath);
  return vscode.Uri.file(path.resolve(baseDir, p));
}
