export type ArtifactType = string;

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
}

export interface Artifact {
  type: ArtifactType;
  data: unknown;
  // Optional: used for caching/traceability
  sourceFile?: string;
}

export interface ArtifactStore {
  add(a: Artifact): void;
  all(type?: string): Artifact[];
}

export interface PluginContext {
  artifacts: ArtifactStore;
  diagnostics: Diagnostic[];
  // You can add fs/projectGraph/symbols later
}

export interface Plugin {
  name: string;
  provides?: ArtifactType[];
  consumes?: ArtifactType[];
  run(ctx: PluginContext): Promise<void> | void;
}
