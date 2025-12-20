import * as fs from "node:fs";
import * as path from "node:path";
import { scanImports } from "./importer";
import type { ModuleGraph, FileAst, ImportNode } from "./module";


export type ModuleGraphOptions = {
  enableAutoLink?: boolean; // default true
  projectRoot?: string | null; // reserved for later
};

function readText(fileAbs: string): string {
  return fs.readFileSync(fileAbs, "utf8");
}

function fileExists(fileAbs: string): boolean {
  try {
    return fs.statSync(fileAbs).isFile();
  } catch {
    return false;
  }
}

function listAutoLinked(entryAbs: string): string[] {
  const dir = path.dirname(entryAbs);
  const base = path.basename(entryAbs, ".sh1");
  const files = fs.readdirSync(dir);
  const out: string[] = [];
  for (const f of files) {
    if (!f.endsWith(".sh1")) continue;
    if (f === path.basename(entryAbs)) continue;
    // mainfilename.*.sh1
    if (f.startsWith(base + ".") && f.endsWith(".sh1")) {
      out.push(path.join(dir, f));
    }
  }
  // stable order for determinism
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function resolveImport(fromFileAbs: string, raw: string): string {
  // For now: relative to importing file dir.
  // Later: if raw starts with "/" treat as project-root import, etc.
  const fromDir = path.dirname(fromFileAbs);
  const resolved = path.resolve(fromDir, raw);
  return resolved;
}

function parseFileForGraph(fileAbs: string): FileAst {
  const src = readText(fileAbs);
  const rawImports = scanImports(src);

  const imports: ImportNode[] = rawImports.map((raw) => ({
    kind: "Import",
    raw,
    resolved: resolveImport(fileAbs, raw),
    fromFile: fileAbs,
  }));

  return {
    kind: "File",
    file: fileAbs,
    imports,
  };
}

export function buildModuleGraph(entryFile: string, opts: ModuleGraphOptions = {}): ModuleGraph {
  const enableAutoLink = opts.enableAutoLink !== false;

  const entryAbs = path.resolve(entryFile);
  if (!fileExists(entryAbs)) {
    throw new Error(`Entry file not found: ${entryAbs}`);
  }

  const nodes = new Map<string, FileAst>();
  const edges = new Map<string, Set<string>>();

  // DFS with cycle detection
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const addEdge = (from: string, to: string) => {
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from)!.add(to);
  };

  const visit = (fileAbs: string) => {
    const st = state.get(fileAbs);
    if (st === "done") return;
    if (st === "visiting") {
      // cycle: show stack from first occurrence
      const idx = stack.indexOf(fileAbs);
      const cycle = (idx >= 0 ? stack.slice(idx) : stack).concat([fileAbs]);
      throw new Error(`Import cycle detected:\n  ${cycle.join("\n  -> ")}`);
    }

    state.set(fileAbs, "visiting");
    stack.push(fileAbs);

    const ast = parseFileForGraph(fileAbs);
    nodes.set(fileAbs, ast);

    for (const imp of ast.imports) {
      const target = imp.resolved;
      if (!fileExists(target)) {
        throw new Error(
          `Import not found.\n  from: ${fileAbs}\n  raw:  ${imp.raw}\n  resolved: ${target}`
        );
      }
      addEdge(fileAbs, target);
      visit(target);
    }

    stack.pop();
    state.set(fileAbs, "done");
  };

  // First: auto-link libs (treated as roots that also become reachable)
  if (enableAutoLink) {
    for (const libAbs of listAutoLinked(entryAbs)) {
      visit(libAbs);
    }
  }

  // Then: entry
  visit(entryAbs);

  // Topological order (Kahn) over the collected nodes
  const all = [...nodes.keys()];
  const indeg = new Map<string, number>(all.map((f) => [f, 0]));

  for (const [from, tos] of edges.entries()) {
    for (const to of tos) {
      // only count edges inside known set
      if (indeg.has(to)) indeg.set(to, (indeg.get(to) ?? 0) + 1);
    }
  }

  const queue = all.filter((f) => (indeg.get(f) ?? 0) === 0).sort();
  const order: string[] = [];

  while (queue.length) {
    const f = queue.shift()!;
    order.push(f);
    const tos = edges.get(f);
    if (!tos) continue;
    for (const to of tos) {
      if (!indeg.has(to)) continue;
      indeg.set(to, (indeg.get(to) ?? 0) - 1);
      if ((indeg.get(to) ?? 0) === 0) {
        queue.push(to);
        queue.sort();
      }
    }
  }

  if (order.length !== all.length) {
    throw new Error("Topological sort failed (graph may have a cycle or missing nodes).");
  }

  return { entryFile: entryAbs, nodes, edges, order };
}
