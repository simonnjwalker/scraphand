// engine/src/project/projectGraph.ts
import { Diagnostics } from "./diagnostics";
import { ImportResolver } from "./importResolver";
import { RuntimeFS } from "./fs";
import { DocumentInfo, ImportEdge, ProjectGraph } from "./types";
import {
  ExtractCommandsFn,
  ParseFn,
  fallbackExtractCommandsFromText,
} from "./ast";
import * as path from "node:path";

export interface BuildGraphOptions {
  entryFile: string;
  parse: ParseFn;
  extractCommands?: ExtractCommandsFn;
}

export async function buildProjectGraph(
  fs: RuntimeFS,
  resolver: ImportResolver,
  diag: Diagnostics,
  opts: BuildGraphOptions
): Promise<ProjectGraph> {
  const documents = new Map<string, DocumentInfo>();
  const edges: ImportEdge[] = [];

  /* ------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------ */

  async function loadDoc(fileId: string): Promise<DocumentInfo | null> {
    const norm = fs.normalize(fileId);
    if (documents.has(norm)) return documents.get(norm)!;

    if (!(await fs.exists(norm))) {
      diag.error(`File not found: ${norm}`, norm, undefined, "E_FILE_NOT_FOUND");
      return null;
    }

    const text = await fs.readText(norm);
    const ast = opts.parse(text, norm);

    let commands = opts.extractCommands ? opts.extractCommands(ast) : null;
    if (!commands) commands = fallbackExtractCommandsFromText(text);

    const info: DocumentInfo = { fileId: norm, text, ast, commands };
    documents.set(norm, info);
    return info;
  }

  async function resolveImplicitCompanions(fileId: string): Promise<string[]> {
    const dir = fs.dirname(fileId);
    const base = path.basename(fileId, path.extname(fileId)); // "main"
    const entries = await fs.readDir(dir);

    const matches = entries
      .filter(
        (name) =>
          name.startsWith(base + ".") &&
          name.endsWith(".sh1")
      )
      .map((name) => fs.normalize(fs.resolve(dir, name)))
      .filter((p) => p !== fs.normalize(fileId));

    matches.sort(); // deterministic ordering
    return matches;
  }

  /* ------------------------------------------------------------
   * Graph traversal
   * ------------------------------------------------------------ */

  async function visit(fileId: string): Promise<void> {
    const doc = await loadDoc(fileId);
    if (!doc) return;

    // ---- Implicit companion files: base.*.sh1 ----
    const companions = await resolveImplicitCompanions(doc.fileId);
    for (const comp of companions) {
      edges.push({
        from: doc.fileId,
        to: comp,
        via: "<implicit-companion>",
      });

      if (!documents.has(comp)) {
        await visit(comp);
      }
    }

    // ---- Explicit imports ----
    for (const cmd of doc.commands) {
      if (cmd.name !== "import") continue;

      const imp = cmd.arg ?? "";
      const to = await resolver.resolveImportExisting(doc.fileId, imp);

      if (!to) {
        diag.error(
          `Import not found: "${imp}"`,
          doc.fileId,
          cmd.span,
          "E_IMPORT_NOT_FOUND"
        );
        continue;
      }

      const normTo = fs.normalize(to);

      edges.push({
        from: doc.fileId,
        to: normTo,
        via: imp,
        span: cmd.span,
      });

      if (!documents.has(normTo)) {
        await visit(normTo);
      }
    }
  }

  /* ------------------------------------------------------------
   * Entry
   * ------------------------------------------------------------ */

  const entryNorm = fs.normalize(opts.entryFile);
  await visit(entryNorm);

  return {
    entryFile: entryNorm,
    documents,
    edges,
  };
}
