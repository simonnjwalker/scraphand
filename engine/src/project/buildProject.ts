import { Diagnostics } from "./diagnostics";
import { RuntimeFS } from "./fs";
import { ImportResolver, ImportResolverOptions } from "./importResolver";
import { buildProjectGraph, BuildGraphOptions } from "./projectGraph";
import { buildSymbolTable, BuildSymbolsOptions } from "./symbolTable";
import { ProjectGraph, SymbolTable } from "./types";

export interface BuildProjectOptions {
  fs: RuntimeFS;
  importResolver: ImportResolverOptions;
  graph: BuildGraphOptions;
  symbols?: BuildSymbolsOptions;
}

export interface ProjectRuntime {
  graph: ProjectGraph;
  symbols: SymbolTable;
  diagnostics: Diagnostics;
}

export async function buildProjectRuntime(opts: BuildProjectOptions): Promise<ProjectRuntime> {
  const diagnostics = new Diagnostics();
  const resolver = new ImportResolver(opts.fs, opts.importResolver);

  const graph = await buildProjectGraph(opts.fs, resolver, diagnostics, opts.graph);
  const symbols = buildSymbolTable(diagnostics, graph.documents.values(), opts.symbols);

  return { graph, symbols, diagnostics };
}
