// src/core/tokens.ts
import type { SourceRange } from "./ast";

export type TokenKind = "Text" | "Block" | "EOF";

export interface BaseToken {
  kind: TokenKind;
  value: string;
  range: SourceRange;
}

/** Plain text token. */
export interface TextToken extends BaseToken {
  kind: "Text";
  value: string;
}

/** Block token: either { ... } or literal blocks like {{ ... }} */
export interface BlockToken extends BaseToken {
  kind: "Block";
  /**
   * "ordinary" for { ... }
   * "literal"  for {{...}}, {{{...}}}, {{{{...}}}}.
   */
  blockType: "ordinary" | "literal";
  /** 1 for { ... }, 2/3/4 for literal blocks. */
  delimiterLength: 1 | 2 | 3 | 4;
  value: string; // content inside the block
}

/** End-of-file token. */
export interface EOFToken extends BaseToken {
  kind: "EOF";
  value: "";
}

export type Token = TextToken | BlockToken | EOFToken;
