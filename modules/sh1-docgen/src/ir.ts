// modules/sh1-docgen/src/ir.ts
import type { BlockType } from "sh1-core";

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "b" | "i" | "u"; text: string }
  | { kind: "citation"; key: string; locator?: string; formatted?: string }
  | { kind: "rawCommand"; name: string; arg: string };

export type Block =
  | { kind: "heading"; level: number; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | {
      kind: "literal";
      text: string;
      detectedType: BlockType;
      confidence: number;
    }
  | {
      kind: "bibliography";
      style?: string;          // eg "apa7"
      title?: string;          // eg "References"
      entries: string[];       // formatted lines
    };

export interface DocIR {
  entryFile: string;
  blocks: Block[];
}
