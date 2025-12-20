// src/core/parser.ts

import {
  DocumentNode,
  AstNode,
  SourcePosition,
  SourceRange,
} from "./ast";
import { lex } from "./lexer";

/**
 * ============================================================
 * Parser
 * ============================================================
 *
 * Overloads:
 *   parse(source, fileName) → normal parse
 *   parse(source)           → parse + CLI output (stdin mode)
 * ============================================================
 */

// Overload signatures
export function parse(source: string): DocumentNode;
export function parse(source: string, fileName: string): DocumentNode;

// Implementation
export function parse(source: string, fileName?: string): DocumentNode {
  const effectiveFileName = fileName ?? "<stdin>";
  const tokens = lex(source);

  let offset = 0;
  let line = 1;
  let column = 1;

  const position = (): SourcePosition => ({
    offset,
    line,
    column,
  });

  const advanceByText = (text: string) => {
    for (const ch of text) {
      offset++;
      if (ch === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
  };

  const children: AstNode[] = [];

  for (const t of tokens) {
    const start = position();

    let textLength = 0;

    if (t.type === "Text") {
      textLength = t.value.length;
    } else if (t.type === "Command") {
      textLength = t.rawContent.length + 2;
    } else if (t.type === "LiteralBlock") {
      textLength = t.content.length + t.delimiterLength * 2;
    }

    advanceByText(source.slice(offset, offset + textLength));
    const end = position();

    const range: SourceRange = { start, end };

    children.push({
      ...t,
      range,
      raw: source.slice(start.offset, end.offset),
    } as AstNode);
  }

  const document: DocumentNode = {
    type: "Document",
    fileName: effectiveFileName,
    range: {
      start: { line: 1, column: 1, offset: 0 },
      end: position(),
    },
    children,
  };

  // CLI / REPL mode: no filename provided
  if (!fileName) {
    console.log(JSON.stringify(document, null, 2));
  }

  return document;
}
