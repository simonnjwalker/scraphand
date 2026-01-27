// modules/sh1-runtime/src/index.ts

export type ArtifactType = string;

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
}

export interface Artifact {
  type: ArtifactType;
  data: unknown;
  sourceFile?: string;
}

export interface ArtifactStore {
  add(a: Artifact): void;
  all(type?: string): Artifact[];
}

/**
 * Minimal shape of the engine's project graph exposed to plugins.
 * Keep this small and structural to avoid tight coupling.
 */
export interface ProjectDocumentLike {
  fileId: string;
  text: string;
  ast: any; // engine AST (DocumentNode) - plugins treat it as data
}

export interface ProjectGraphLike {
  entryFile: string;
  documents: Map<string, ProjectDocumentLike>;
  edges: Array<{ from: string; to: string; via?: string }>;
}

/**
 * Host services provided by the engine to plugins.
 */
export interface HostAPI {
  cwd: string;

  resolveOutputPath(relPath: string): string;

  writeTextFile(absPath: string, content: string): Promise<void>;

  writeBinaryFile(absPath: string, data: Uint8Array): Promise<void>;

  // Optional: if your engine supports it (used for zero re-render embedding).
  // If not implemented yet, plugins should feature-detect before calling.
  readBinaryFile?(absPath: string): Promise<Uint8Array>;
}

export interface OutputSpec {
  type: string; // e.g. "html", "docx"
  path: string; // e.g. "out/report.html"
  plugin?: string; // optional future filter, e.g. plugin="sh1-docx"
}

export type LineBreakMode = "asis" | "latexish" | "latexishParagraph";

export interface TextOptions {
  /**
   * "asis"             -> keep line breaks inside paragraphs; paragraph breaks on 2+ newlines
   * "latexish"         -> join consecutive non-empty lines with lineJoiner;
   *                       1 blank line => line break; 2+ => paragraph break
   * "latexishParagraph"-> join consecutive non-empty lines with lineJoiner;
   *                       1+ blank line => paragraph break
   */
  lineBreakMode?: LineBreakMode;

  /**
   * Used when joining consecutive non-empty lines in latexish modes.
   * Examples: " ", "  ", "\u00A0"
   * Special value: "nbsp" -> "\u00A0"
   */
  lineJoiner?: string;
}

export type TagRenderMode = "render" | "show-only" | "show-and-render";

export interface RenderTagOptions {
  /**
   * "render"          -> normal behaviour
   * "show-only"       -> show tags verbatim, do not apply formatting/effects
   * "show-and-render" -> apply effect, but display the full tag text (e.g. "{b:Hello}") as the rendered text
   */
  mode?: TagRenderMode;

  /** If false, hide {import:...} {define:...} {config:...} from output */
  showCore?: boolean;

  /** If true, only show tags for unknown/unrecognised commands */
  unknownOnly?: boolean;

  /**
   * If true, show unknown tags even when mode="render"
   * (handy for debugging without turning on show-only).
   */
  showUnknownInRenderMode?: boolean;
}

export interface RenderOptions {
  tag?: RenderTagOptions;
}

export interface ConfigLike {
  outputs?: OutputSpec[];
  plugins?: string[];

  // New:
  text?: TextOptions;
  render?: RenderOptions;

  // Keep other future areas here:
  // bibliography?: {...}
  // importing?: {...}
}

export interface PluginContext {
  artifacts: ArtifactStore;
  diagnostics: Diagnostic[];

  entryFile: string;
  project: ProjectGraphLike;
  host: HostAPI;

  // Stage 1+: config-driven behaviour
  config: ConfigLike;
}

export interface Plugin {
  name: string;
  provides?: ArtifactType[];
  consumes?: ArtifactType[];
  run(ctx: PluginContext): Promise<void> | void;
}
