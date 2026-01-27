import type {
  Diagnostic,
  Plugin,
  PluginContext,
  HostAPI,
  ProjectGraphLike,
  ConfigLike
} from "sh1-runtime";
import { InMemoryArtifactStore } from "./artifactStore";

export interface RunPluginsResult {
  artifacts: InMemoryArtifactStore;
  diagnostics: Diagnostic[];
}

export interface RunPluginsBase {
  entryFile: string;
  project: ProjectGraphLike;
  host: HostAPI;

  // Stage 1
  config: ConfigLike;
}

export type RunPluginsExtra = Partial<Omit<
  PluginContext,
  keyof RunPluginsBase | "artifacts" | "diagnostics"
>>;

export async function runPlugins(
  plugins: Plugin[],
  base: RunPluginsBase,
  extra?: RunPluginsExtra
): Promise<RunPluginsResult> {
  const artifacts = new InMemoryArtifactStore();
  const diagnostics: Diagnostic[] = [];

  const ctx: PluginContext = {
    artifacts,
    diagnostics,
    entryFile: base.entryFile,
    project: base.project,
    host: base.host,
    config: base.config,
    ...(extra ?? {}),
  };

  for (const p of plugins) {
    try {
      await p.run(ctx);
    } catch (e: any) {
      diagnostics.push({
        severity: "error",
        code: "E_PLUGIN_CRASH",
        message: `Plugin "${p.name}" crashed: ${String(e?.message ?? e)}`,
      });
    }
  }

  return { artifacts, diagnostics };
}
