// src/core/lexer.ts

import {
  SourcePosition,
  SourceRange,
  TextNode,
  CommandNode,
  LiteralBlockNode,
} from "./ast";


type LexText = {
  type: "Text";
  value: string;
};

type LexCommand = {
  type: "Command";
  rawContent: string;
};

type LexLiteralBlock = {
  type: "LiteralBlock";
  delimiterLength: number;
  content: string;
};

export type LexToken =
  | LexText
  | LexCommand
  | LexLiteralBlock;




/**
 * Lexer responsibilities:
 * - Walk the source text once
 * - Produce coarse-grained AST nodes
 * - NO semantic parsing of command contents
 */

export function lex(source: string): LexToken[] {
  const nodes: any[] = [];
  let i = 0;

  const advance = (n = 1) => (i += n);
  const peek = (n = 0) => source[i + n];

  let buffer = "";

  const flushText = () => {
    if (buffer.length > 0) {
      nodes.push({
        type: "Text",
        value: buffer,
      });
      buffer = "";
    }
  };

  while (i < source.length) {
    // Line comment
    if (peek() === "/" && peek(1) === "/") {
      flushText();
      while (i < source.length && peek() !== "\n") advance();
      continue;
    }

    // Block comment
    if (peek() === "/" && peek(1) === "*") {
      flushText();
      advance(2);
      while (i < source.length && !(peek() === "*" && peek(1) === "/")) advance();
      advance(2);
      continue;
    }

    // Literal block {{...}}, {{{...}}}, etc.
    if (peek() === "{" && peek(1) === "{") {
      flushText();

      let depth = 2;
      while (peek(depth) === "{") depth++;

      const open = "{".repeat(depth);
      const close = "}".repeat(depth);

      advance(depth);

      const start = i;
      while (i < source.length && source.slice(i, i + depth) !== close) {
        advance();
      }

      const content = source.slice(start, i);
      advance(depth);

      nodes.push({
        type: "LiteralBlock",
        delimiterLength: depth,
        content,
      });
      continue;
    }

    // Ordinary command { ... }
    if (peek() === "{") {
      flushText();
      advance(); // skip '{'

      const start = i;
      while (i < source.length && peek() !== "}") advance();
      const rawContent = source.slice(start, i);
      advance(); // skip '}'

      nodes.push({
        type: "Command",
        rawContent,
      });
      continue;
    }

    buffer += peek();
    advance();
  }

  flushText();
  return nodes;
}
