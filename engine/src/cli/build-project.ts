// engine/src/cli/build-project.ts
import path from "node:path";
import { NodeFS } from "../project/fs";
import { buildProjectRuntime } from "../project/buildProject";
import { parse } from "../core/parser";
import { extractCommandsFromScraphandAst } from "../project/adapter";

export async function buildProject(entryFile: string) {
  const fs = new NodeFS();

  const runtime = await buildProjectRuntime({
    fs,
    importResolver: {
      base: "fileDir", // or "workspaceRoot"
      extensions: [".sh1"],
      // workspaceRoot: process.cwd(), // only if using workspaceRoot
    },
    graph: {
      entryFile: path.resolve(entryFile),
      parse: (text, fileId) => parse(text, fileId),
      extractCommands: extractCommandsFromScraphandAst,
      // No implicitLibraries here anymore.
      // Implicit loading is now handled by projectGraph.ts via myfile.*.sh1 companions.
    },
    symbols: { enforceUnique: false },
  });

  return runtime;
}


// Optional: allow running this file directly too
async function main() {
  const entryArg = process.argv[2];
  if (!entryArg) {
    console.error("Usage: build-project <entry-file>");
    process.exit(1);
  }

  const runtime = await buildProject(entryArg);

  console.log("=== Diagnostics ===");
  console.log(runtime.diagnostics.all());

  console.log("\n=== Files ===");
  for (const f of runtime.graph.documents.keys()) console.log(" ", f);

  console.log("\n=== Imports ===");
  for (const e of runtime.graph.edges) {
    console.log(` ${e.from} -> ${e.to} via ${e.via ?? ""}`.trimEnd());
  }

  console.log("\n=== Symbols ===");
  for (const [name, defs] of runtime.symbols.defs) {
    for (const d of defs) console.log(` ${name} defined in ${d.definedIn}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

