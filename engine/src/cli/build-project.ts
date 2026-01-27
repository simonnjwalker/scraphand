// engine/src/cli/build-project.ts
import path from "node:path";
import fsPromises from "node:fs/promises";
import { NodeFS } from "../project/fs";
import { buildProjectRuntime } from "../project/buildProject";
import { parse } from "../core/parser";
import { extractCommandsFromScraphandAst } from "../project/adapter";
import { loadPlugins } from "../runtime/moduleLoader";
import { runPlugins } from "../runtime/runPlugins";
import type { HostAPI, ConfigLike } from "sh1-runtime";
import { parsePlugins } from "../runtime/parsePlugins";

async function ensureDirForFile(absPath: string) {
  await fsPromises.mkdir(path.dirname(absPath), { recursive: true });
}

export async function buildProject(entryFile: string, pluginNames: string[] = []) {
  const fs = new NodeFS();

  const runtime = await buildProjectRuntime({
    fs,
    importResolver: { base: "fileDir", extensions: [".sh1"] },
    graph: {
      entryFile: path.resolve(entryFile),
      parse: (text, fileId) => parse(text, fileId),
      extractCommands: extractCommandsFromScraphandAst,
    },
    symbols: { enforceUnique: false },
  });

  const absEntry = path.resolve(entryFile);
  const entryDir = path.dirname(absEntry);

  const host: HostAPI = {
    cwd: process.cwd(),

    resolveOutputPath(relPath: string) {
      return path.resolve(entryDir, relPath);
    },

    async writeTextFile(absPath: string, content: string) {
      await ensureDirForFile(absPath);
      await fsPromises.writeFile(absPath, content, "utf8");
    },

    async writeBinaryFile(absPath: string, data: Uint8Array) {
      await ensureDirForFile(absPath);
      await fsPromises.writeFile(absPath, data);
    },

    async readBinaryFile(absPath: string) {
      const buf = await fsPromises.readFile(absPath);
      return new Uint8Array(buf);
    },
  };

  const engineConfig: ConfigLike = parsePlugins(runtime.graph);

  const requested = pluginNames.length ? pluginNames : engineConfig.plugins ?? [];
  const { plugins, missing } = await loadPlugins(requested);

  const missingWarnings = missing.map((m: { name: string; error: string }) => ({
    severity: "warning" as const,
    code: "W_PLUGIN_NOT_FOUND",
    message: `Plugin not loaded: ${m.name}\n${m.error}`,
  }));

  const { artifacts, diagnostics } = await runPlugins(plugins, {
    entryFile: runtime.graph.entryFile,
    project: runtime.graph,
    host,
    config: engineConfig,
  });

  diagnostics.unshift(...missingWarnings);

  if (diagnostics.length) {
    console.log("=== Plugin diagnostics ===");
    for (const d of diagnostics) console.log(`[${d.severity}] ${d.message}`);
  }

  return { runtime, artifacts, diagnostics };
}
