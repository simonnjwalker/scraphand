#!/usr/bin/env node
import path from "node:path";
import { buildProject } from "./build-project";

async function main() {
  const [, , cmd, ...args] = process.argv;

  switch (cmd) {
    case "build": {
      const entry = args[0];
      if (!entry) {
        console.error("Usage: scraphand build <file>");
        process.exit(1);
      }
      await buildProject(path.resolve(entry));
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
