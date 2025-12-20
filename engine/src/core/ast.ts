// src/core/ast.ts

/**
 * ============================================================
 * Core AST definitions for the sh1 language
 * ============================================================
 *
 * This AST represents the syntactic structure of a *single file*.
 * It does NOT represent module graphs, imports, or project state.
 *
 * Module / project-level structures live in:
 *   src/project/module-ast.ts
 * ============================================================
 */

/** A location in the source text (for error messages, IDE features, etc.) */
export interface SourcePosition {
  line: number;   // 1-based
  column: number; // 1-based
  offset: number; // 0-based index in the full string
}

/** A contiguous range in the source text */
export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

/** Base interface for all AST nodes */
export interface NodeBase {
  type: string;
  range: SourceRange;

  /**
   * Optional raw slice of the source text corresponding to this node.
   * Useful for debugging, formatting, and IDE features.
   */
  raw?: string;
}

/** Plain text node (outside any blocks) */
export interface TextNode extends NodeBase {
  type: "Text";
  value: string;
}

/**
 * Ordinary command block: { ... }
 *
 * NOTE:
 * - rawContent is preserved exactly (minus outer braces)
 * - semantic parsing of commands happens later
 */
export interface CommandNode extends NodeBase {
  type: "Command";
  rawContent: string;
}

/**
 * Literal block: {{ ... }}, {{{ ... }}}, {{{{ ... }}}}, etc.
 *
 * Rules:
 * - Content is absolutely literal
 * - No escaping, no comments stripped
 */
export interface LiteralBlockNode extends NodeBase {
  type: "LiteralBlock";
  delimiterLength: number; // 2, 3, 4, ...
  content: string;
}

/** Root document node */
export interface DocumentNode extends NodeBase {
  type: "Document";
  fileName: string;
  children: AstNode[];
}

/** Union of all AST node types */
export type AstNode =
  | TextNode
  | CommandNode
  | LiteralBlockNode
  | DocumentNode;
