#!/usr/bin/env node
import path from "node:path";
import { buildProject } from "./build-project";

function parseFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parsePluginsArg(): string[] {
  const pluginsArg = process.argv.find((a) => a.startsWith("--plugins="));
  if (!pluginsArg) return [];
  return pluginsArg
    .slice("--plugins=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const [, , cmd, entryArg, ...rest] = process.argv;

  switch (cmd) {
    case "build": {
      const entry = entryArg;
      if (!entry) {
        console.error("Usage: scraphand build <file> [--plugins=a,b] [--list-plugins] [--dump-artifacts[=dir]]");
        process.exit(1);
      }

      const listPlugins = parseFlag("--list-plugins");

      // --dump-artifacts or --dump-artifacts=some/dir
      const dumpArg = rest.find((a) => a === "--dump-artifacts" || a.startsWith("--dump-artifacts="));
      const dumpArtifacts =
        dumpArg === "--dump-artifacts"
          ? true
          : dumpArg?.startsWith("--dump-artifacts=")
            ? dumpArg.slice("--dump-artifacts=".length)
            : false;

      const pluginNames = parsePluginsArg();

      await buildProject(path.resolve(entry), pluginNames);
      break;
    }

    default:
      console.error("Unknown command:", cmd);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
