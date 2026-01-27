// engine/src/runtime/moduleLoader.ts
import type { Plugin } from "sh1-runtime";

export interface LoadPluginsResult {
  plugins: Plugin[];
  missing: { name: string; error: string }[];
}

export async function loadPlugins(names: string[]): Promise<LoadPluginsResult> {
  const plugins: Plugin[] = [];
  const missing: { name: string; error: string }[] = [];

  for (const name of names) {
    try {
      const mod: any = await import(name);
      const plugin: Plugin | undefined = mod?.default ?? mod?.plugin;

      if (!plugin || typeof plugin.name !== "string" || typeof plugin.run !== "function") {
        missing.push({
          name,
          error: "Module did not export a valid Plugin (expected default export or plugin export).",
        });
        continue;
      }

      plugins.push(plugin);
    } catch (e: any) {
      missing.push({ name, error: String(e?.message ?? e) });
    }
  }

  return { plugins, missing };
}
