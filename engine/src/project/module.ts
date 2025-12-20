// src/project/module.ts

/**
 * ============================================================
 * Project-level module graph types
 * ============================================================
 *
 * These types describe how multiple .sh1 files relate to each other.
 * They are NOT part of the core language AST.
 */

export type ImportNode = {
  kind: "Import";
  raw: string;
  resolved: string;
  fromFile: string;
};

export type FileAst = {
  kind: "File";
  file: string;
  imports: ImportNode[];
};

export type ModuleGraph = {
  entryFile: string;
  nodes: Map<string, FileAst>;
  edges: Map<string, Set<string>>;
  order: string[];
};
