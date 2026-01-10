import path from "node:path";
import { NodeFS } from "../project/fs";
import { buildProjectRuntime } from "../project/buildProject";
import { parse } from "../core/parser";
import { extractCommandsFromScraphandAst } from "../project/adapter";

import { AssetStore } from "../project/execute/context";
import { CommandRegistry } from "../project/execute/registry";
import { dispatchDocument } from "../project/execute/dispatcher";

import { ConfigBuilder } from "../project/config/builder";
import { registerConfigPlugin } from "../project/execute/plugins/config";

export async function printConfig(entryFile: string) {
  const fs = new NodeFS();
  const entry = path.resolve(entryFile);

  const runtime = await buildProjectRuntime({
    fs,
    importResolver: { base: "fileDir", extensions: [".sh1"] },
    graph: {
      entryFile: entry,
      parse: (text, fileId) => parse(text, fileId),
      extractCommands: extractCommandsFromScraphandAst,
      // No implicitLibraries here anymore.
      // Implicit loading is now handled by projectGraph.ts via myfile.*.sh1 companions.
    },
    symbols: { enforceUnique: false },
  });


console.log("=== GRAPH FILES ===");
for (const f of runtime.graph.documents.keys()) console.log(" ", f);

console.log("=== GRAPH EDGES ===");
for (const e of runtime.graph.edges) console.log(` ${e.from} -> ${e.to} via ${e.via}`);



  const builder = new ConfigBuilder();
  const registry = new CommandRegistry();
  registerConfigPlugin(registry, builder);

  const assets = new AssetStore();

  // IMPORTANT: apply config across ALL reachable docs in a stable order.
  // Map preserves insertion order, which matches your traversal load order.
for (const doc of orderDocsDependenciesFirst(runtime.graph)) {
    const ctx = {
      graph: runtime.graph,
      symbols: runtime.symbols,
      diagnostics: runtime.diagnostics,
      assets,
      currentDoc: doc,
    };

    await dispatchDocument(doc.ast as any, registry, ctx, {
      errorOnUnknownCommands: false,      // config phase shouldn’t error on normal content
      preserveUnknownAsRaw: false,
    });
  }

  return { config: builder.get(), diagnostics: runtime.diagnostics.all() };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: print-config <entry-file>");
    process.exit(1);
  }

  printConfig(file)
    .then((out) => console.log(JSON.stringify(out, null, 2)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

function orderDocsDependenciesFirst(graph: any): any[] {
  const visited = new Set<string>();
  const ordered: any[] = [];

  const edgesByFrom = new Map<string, string[]>();
  for (const e of graph.edges) {
    const arr = edgesByFrom.get(e.from) ?? [];
    arr.push(e.to);
    edgesByFrom.set(e.from, arr);
  }

  function dfs(fileId: string) {
    if (visited.has(fileId)) return;
    visited.add(fileId);

    for (const dep of edgesByFrom.get(fileId) ?? []) {
      dfs(dep);
    }

    const doc = graph.documents.get(fileId);
    if (doc) ordered.push(doc);
  }

  dfs(graph.entryFile);

  return ordered;
}
