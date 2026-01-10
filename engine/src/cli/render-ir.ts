import path from "node:path";
import { NodeFS } from "../project/fs";
import { buildProjectRuntime } from "../project/buildProject";
import { parse } from "../core/parser";
import { extractCommandsFromScraphandAst } from "../project/adapter";

import { AssetStore } from "../project/execute/context";
import { CommandRegistry } from "../project/execute/registry";
import { dispatchDocument } from "../project/execute/dispatcher";
import { registerCorePlugin } from "../project/execute/plugins/core";
import { registerHtmlPlugin } from "../project/execute/plugins/html";

export async function renderIr(entryFile: string) {
  const fs = new NodeFS();
  const entry = path.resolve(entryFile);

  const runtime = await buildProjectRuntime({
    fs,
    importResolver: { base: "fileDir", extensions: [".sh1"] },
    graph: {
      entryFile: entry,
      parse: (text, fileId) => parse(text, fileId),
      extractCommands: extractCommandsFromScraphandAst,
    },
    symbols: { enforceUnique: false },
  });

  // Load entry doc AST from graph (already parsed)
  const entryDoc = runtime.graph.documents.get(entry);
  if (!entryDoc) throw new Error(`Entry not loaded: ${entry}`);

  const registry = new CommandRegistry();
  registerCorePlugin(registry);
  registerHtmlPlugin(registry);

  const assets = new AssetStore();

  const ctx = {
    graph: runtime.graph,
    symbols: runtime.symbols,
    diagnostics: runtime.diagnostics,
    assets,
    currentDoc: entryDoc,
  };

  const ir = await dispatchDocument(entryDoc.ast as any, registry, ctx, {
    errorOnUnknownCommands: true,
    preserveUnknownAsRaw: true,
  });

  return { ir, diagnostics: runtime.diagnostics.all(), assets: assets.all() };
}

// Optional direct run
if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: render-ir <entry-file>");
    process.exit(1);
  }

  renderIr(file)
    .then((out) => console.log(JSON.stringify(out, null, 2)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
