import * as vscode from "vscode";
import { CommandIndex } from "./intellisense/indexer";
import { registerArgumentIntellisense } from "./intellisense/argCompletion";
import { scanCommands } from "./intellisense/parser";
import * as path from "node:path";

type CommandOrigin = "builtin" | "library";

interface CommandInfo {
  name: string;
  origin: CommandOrigin;
  documentation: string;
  definedAt?: vscode.Location; // for library commands
}

// ---------------- Builtins ----------------
const BUILTINS: Record<string, Omit<CommandInfo, "name">> = {
  import: {
    origin: "builtin",
    documentation:
      "Imports another Scraphand file.\n\nSyntax: `{import:path}`\nExample: `{import:lib/html.sh1}`",
  },
  define: {
    origin: "builtin",
    documentation:
      "Defines a command in a library file.\n\nSyntax: `{define:name}`\nExample (in lib): `{define:h1}`",
  },
};

// Suggested future commands (not active unless you add them to BUILTINS or libs)
export const SUGGESTED_COMMANDS = [
  "include",
  "set",
  "get",
  "if",
  "for",
  "link",
  "img",
  "b",
  "i",
];




function getCommandAtPosition(
  doc: vscode.TextDocument,
  pos: vscode.Position
): { name: string; range: vscode.Range } | null {
  const text = doc.getText();
  const offset = doc.offsetAt(pos);

  for (const tok of scanCommands(text)) {
    // token spans from '{' to '}'
    if (offset < tok.startOffset || offset > tok.endOffset) continue;

    const cmdStartOffset = tok.startOffset + 1; // after '{'
    const cmdEndOffset = cmdStartOffset + tok.name.length;

    const range = new vscode.Range(
      doc.positionAt(cmdStartOffset),
      doc.positionAt(cmdEndOffset)
    );

    return { name: tok.name, range };
  }

  return null;
}


function isInsideCommandNameArea(doc: vscode.TextDocument, pos: vscode.Position): boolean {
  const line = doc.lineAt(pos.line).text;
  const before = line.slice(0, pos.character);
  const lastOpen = before.lastIndexOf("{");
  if (lastOpen === -1) return false;

  const afterOpen = before.slice(lastOpen + 1);
  if (afterOpen.includes(":")) return false; // already in arg
  if (afterOpen.includes("}")) return false; // block already closed
  return true;
}

// ---------------- Import + Define indexing ----------------
class ScraphandCommandIndex {
  private libraryCommands = new Map<string, CommandInfo>();

  // Hard-coded example library command so you see it immediately even without imports
  seedHardcodedH1() {
    const fake = vscode.Uri.file("c:/path/to/lib/html.sh1");
    this.libraryCommands.set("h1", {
      name: "h1",
      origin: "library",
      documentation: "HTML heading level 1.\n\nExample: `{h1:Title}`",
      definedAt: new vscode.Location(fake, new vscode.Position(0, 0)),
    });
  }

  clearLibrary() {
    this.libraryCommands.clear();
  }

  getCommand(name: string): CommandInfo | null {
    if (name in BUILTINS) return { name, ...BUILTINS[name] };
    return this.libraryCommands.get(name) ?? null;
  }

  listBuiltins(): CommandInfo[] {
    return Object.keys(BUILTINS).map((name) => ({ name, ...BUILTINS[name] }));
  }

  listLibrary(): CommandInfo[] {
    return [...this.libraryCommands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Reads {import:path} from current file, opens that file, finds {define:name} and indexes them
  async rebuildFromDocumentImports(doc: vscode.TextDocument) {
    this.clearLibrary();

    // Comment this out once you confirm import-indexing works:
    // this.seedHardcodedH1();

    const imports = findImports(doc);

    for (const imp of imports) {
      const uri = resolveImportToUri(doc.uri, imp.path);
      if (!uri) continue;

      try {
        const importedDoc = await vscode.workspace.openTextDocument(uri);
        const defs = findDefines(importedDoc);

        for (const def of defs) {
          this.libraryCommands.set(def.name, {
            name: def.name,
            origin: "library",
            documentation: `Defined in ${vscode.workspace.asRelativePath(uri)}\n\n(Extend this to include docs/comments.)`,
            definedAt: def.location,
          });
        }
      } catch {
        // ignore open/read errors for MVP
      }
    }
  }
}



function findImports(doc: vscode.TextDocument): { path: string }[] {
  const text = doc.getText();
  const out: { path: string }[] = [];

  for (const tok of scanCommands(text)) {
    if (tok.name !== "import") continue;
    if (!tok.arg) continue;

    const path = tok.arg.trim();
    if (path) out.push({ path });
  }

  return out;
}

function findDefines(
  doc: vscode.TextDocument
): { name: string; location: vscode.Location }[] {
  const text = doc.getText();
  const out: { name: string; location: vscode.Location }[] = [];

  for (const tok of scanCommands(text)) {
    if (tok.name !== "define") continue;
    if (!tok.arg) continue;

    const name = tok.arg.trim();
    if (!name) continue;

    // Location: point at the command name inside "{define:...}"
    const cmdNameOffset = tok.startOffset + 1; // after '{'
    const pos = doc.positionAt(cmdNameOffset);

    out.push({
      name,
      location: new vscode.Location(doc.uri, pos),
    });
  }

  return out;
}



function resolveImportToUri(_from: vscode.Uri, importPath: string): vscode.Uri | null {
  if (path.isAbsolute(importPath)) {
    return vscode.Uri.file(importPath);
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return null;

  return vscode.Uri.joinPath(folder.uri, importPath);
}



// ---------------- Diagnostics (unknown commands) ----------------

function computeDiagnostics(doc: vscode.TextDocument, index: CommandIndex): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  const text = doc.getText();

  for (const tok of scanCommands(text)) {
    const info = index.getCommand(tok.name);
    if (info) continue; // builtin OR library command

    // unknown
    const cmdStart = tok.startOffset + 1; // after '{'
    const cmdEnd = cmdStart + tok.name.length;
    const range = new vscode.Range(doc.positionAt(cmdStart), doc.positionAt(cmdEnd));

    const d = new vscode.Diagnostic(range, `Unknown command "${tok.name}".`, vscode.DiagnosticSeverity.Error);
    d.source = "scraphand";
    diags.push(d);
  }

  return diags;
}


// ---------------- Semantic tokens (editor coloring) ----------------
// builtin -> keyword, library -> function, unknown -> invalid
const tokenTypes = ["keyword", "function", "invalid"] as const;
const legend = new vscode.SemanticTokensLegend([...tokenTypes]);

function buildSemanticTokens(doc: vscode.TextDocument, index: CommandIndex): vscode.SemanticTokens {
  const builder = new vscode.SemanticTokensBuilder(legend);
  const text = doc.getText();

  for (const tok of scanCommands(text)) {
    const info = index.getCommand(tok.name);

    const tokenType =
      info?.origin === "builtin"
        ? "keyword"
        : info?.origin === "library"
          ? "function"
          : "invalid";

    const cmdStartOffset = tok.startOffset + 1; // after '{'
    const pos = doc.positionAt(cmdStartOffset);

    builder.push(
      pos.line,
      pos.character,
      tok.name.length,
      tokenTypes.indexOf(tokenType),
      0
    );
  }

  return builder.build();
}






// ---------------- Activate ----------------
export function activate(context: vscode.ExtensionContext) {

  const diagnostics = vscode.languages.createDiagnosticCollection("scraphand");
  context.subscriptions.push(diagnostics);


  // Optional: seed h1 without imports; remove once your library import is working.
  // index.seedHardcodedH1();

  const index = new CommandIndex();
  registerArgumentIntellisense(context, index);

  async function refresh(doc: vscode.TextDocument) {
    if (doc.languageId !== "scraphand") return;
    await index.rebuildForDocument(doc);
    diagnostics.set(doc.uri, computeDiagnostics(doc, index));
  }



  // async function refresh(doc: vscode.TextDocument) {
  //   if (doc.languageId !== "scraphand") return;
  //   await index.rebuildFromDocumentImports(doc);
  //   diagnostics.set(doc.uri, computeDiagnostics(doc, index));
  // }

  // Refresh on edits/open/switch
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => void refresh(doc)),
    vscode.workspace.onDidChangeTextDocument((e) => void refresh(e.document)),
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed) void refresh(ed.document);
    })
  );

  // Completion items: builtins (Keyword) vs library (Function)
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "scraphand" },
      {
        provideCompletionItems(doc, pos) {
          if (!isInsideCommandNameArea(doc, pos)) return [];

          const items: vscode.CompletionItem[] = [];

          for (const info of index.listBuiltins()) {
            const item = new vscode.CompletionItem(info.name, vscode.CompletionItemKind.Keyword);
            item.detail = "Scraphand builtin";
            item.documentation = new vscode.MarkdownString(info.documentation);
            items.push(item);
          }

          for (const info of index.listLibrary()) {
            const item = new vscode.CompletionItem(info.name, vscode.CompletionItemKind.Function);
            item.detail = "Scraphand library command";
            item.documentation = new vscode.MarkdownString(info.documentation);
            items.push(item);
          }

          return items;
        },
      },
      "{"
    )
  );

  // Hover: show docs + (for library) where it’s defined
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: "scraphand" }, {
      provideHover(doc, pos) {
        const hit = getCommandAtPosition(doc, pos);
        if (!hit) return;

        const info = index.getCommand(hit.name);
        if (!info) return;

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${info.name}**\n\n${info.documentation}`);
        if (info.origin === "library" && info.definedAt) {
          md.appendMarkdown(`\n\nDefined in \`${vscode.workspace.asRelativePath(info.definedAt.uri)}\``);
        }
        return new vscode.Hover(md, hit.range);
      }
    })
  );

  // Go to definition: only for library commands
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider({ language: "scraphand" }, {
      provideDefinition(doc, pos) {
        const hit = getCommandAtPosition(doc, pos);
        if (!hit) return;

        const info = index.getCommand(hit.name);
        if (info?.origin === "library" && info.definedAt) return info.definedAt;

        return undefined;
      }
    })
  );

  // Semantic tokens coloring: builtin vs library vs unknown
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "scraphand" },
      {
        provideDocumentSemanticTokens(doc) {
          return buildSemanticTokens(doc, index);
        }
      },
      legend
    )
  );

  // First run
  if (vscode.window.activeTextEditor) void refresh(vscode.window.activeTextEditor.document);
}

export function deactivate() {}
