import type { Plugin } from "sh1-runtime";
export * from "./blockDetector";

const plugin: Plugin = {
  name: "sh1-core",
  run(ctx) {
    ctx.diagnostics.push({ severity: "info", message: "sh1-core loaded" });
  },
};

export default plugin;
