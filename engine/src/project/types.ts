export type FileId = string; // normalized absolute path or URI string

export interface SourcePos {
  offset: number; // absolute offset in file text
  line?: number;  // optional (fill later if you track)
  col?: number;   // optional
}

export interface SourceSpan {
  start: SourcePos;
  end: SourcePos;
}

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  fileId?: FileId;
  span?: SourceSpan;
  code?: string; // e.g. "E_IMPORT_NOT_FOUND"
}

export interface CommandInstance {
  name: string;       // e.g. "import", "define", "h1"
  arg: string | null; // everything after ':' (raw for now)
  span?: SourceSpan;  // where command name occurs (or whole block)
}

export interface DocumentInfo {
  fileId: FileId;
  text: string;
  // Your parser can return ANY AST type; we keep it as unknown.
  ast: unknown;
  // Commands extracted from the AST (or from a fallback scanner).
  commands: CommandInstance[];
}

export interface ImportEdge {
  from: FileId;
  to: FileId;
  via: string; // the import path string from {import:...}
  span?: SourceSpan;
}

export interface ProjectGraph {
  entryFile: FileId;
  documents: Map<FileId, DocumentInfo>;
  edges: ImportEdge[];
}

export interface SymbolInfo {
  name: string;
  definedIn: FileId;
  span?: SourceSpan;
}

export interface SymbolTable {
  // symbol name -> definitions (support multiple defs; you can enforce “single” later)
  defs: Map<string, SymbolInfo[]>;
}
