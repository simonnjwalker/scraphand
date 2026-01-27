// modules/sh1-docgen/src/index.ts
import type { Plugin } from "sh1-runtime";
import type { DocIR, Block, Inline } from "./ir";
import { detectBlockType, normaliseText } from "sh1-core";

/**
 * Engine AST nodes:
 * - { type: "Text", value: string }
 * - { type: "Command", rawContent: "h1:Title" }
 * - { type: "LiteralBlock", content: string, ... }
 *
 * This docgen module converts those into DocIR.
 *
 * NOTE:
 * - bibliography is a *placeholder tag* at this stage (rawCommand "bibliography")
 * - sh1-cite is responsible for replacing placeholders with real bibliography blocks
 */

const HEADING_LEVELS: Record<string, 1 | 2 | 3 | 4 | 5> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
};

const INLINE_MARKUP = new Set(["b", "i", "u"]);

function parseCommand(rawContent: string): { name: string; arg: string } {
  const idx = rawContent.indexOf(":");
  if (idx === -1) return { name: rawContent.trim(), arg: "" };
  return {
    name: rawContent.slice(0, idx).trim(),
    arg: rawContent.slice(idx + 1),
  };
}

function flushParagraph(blocks: Block[], currentInlines: Inline[]) {
  const hasNonWhitespace = currentInlines.some((x) =>
    x.kind !== "text" ? true : x.text.trim().length > 0
  );
  if (!hasNonWhitespace) {
    currentInlines.length = 0;
    return;
  }

  blocks.push({ kind: "paragraph", inlines: [...currentInlines] });
  currentInlines.length = 0;
}

function isTextNode(n: any): n is { type: "Text"; value: string } {
  return n && n.type === "Text" && typeof n.value === "string";
}
function isCommandNode(n: any): n is { type: "Command"; rawContent: string } {
  return n && n.type === "Command" && typeof n.rawContent === "string";
}
function isLiteralBlockNode(n: any): n is { type: "LiteralBlock"; content: string } {
  return n && n.type === "LiteralBlock" && typeof n.content === "string";
}

function makeInlineFromMarkup(name: string, arg: string): Inline {
  if (name === "b") return { kind: "b", text: arg };
  if (name === "i") return { kind: "i", text: arg };
  if (name === "u") return { kind: "u", text: arg };
  return { kind: "rawCommand", name, arg };
}

const plugin: Plugin = {
  name: "sh1-docgen",
  provides: ["docgen/ir"],
  async run(ctx) {
    const entry = ctx.entryFile;
    const docInfo = ctx.project.documents.get(entry);

    if (!docInfo) {
      ctx.diagnostics.push({
        severity: "error",
        code: "E_DOCGEN_ENTRY_NOT_LOADED",
        message: `docgen: entry file not loaded in project graph: ${entry}`,
      });
      return;
    }

    const ast = docInfo.ast;
    const children: any[] = ast?.children ?? [];

    const blocks: Block[] = [];
    const currentInlines: Inline[] = [];

    for (const node of children) {
      // -------- Text --------
      if (isTextNode(node)) {
        const text = normaliseText(node.value);

        // Simple paragraph splitting on blank lines
        const parts = text.split(/\n{2,}/);
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part) currentInlines.push({ kind: "text", text: part });

          if (i < parts.length - 1) flushParagraph(blocks, currentInlines);
        }
        continue;
      }

      // -------- Command {h1:...}, {b:...}, {bibliography:...}, etc --------
      if (isCommandNode(node)) {
        const { name, arg } = parseCommand(node.rawContent);

        // headings are block-level
        if (name in HEADING_LEVELS) {
          flushParagraph(blocks, currentInlines);
          blocks.push({
            kind: "heading",
            level: HEADING_LEVELS[name],
            inlines: [{ kind: "text", text: arg }],
          });
          continue;
        }

        // inline markup
        if (INLINE_MARKUP.has(name)) {
          currentInlines.push(makeInlineFromMarkup(name, arg));
          continue;
        }

        // everything else stays as a rawCommand
        // (including {bibliography:...} which sh1-cite will later replace)
        currentInlines.push({ kind: "rawCommand", name, arg });
        continue;
      }

      // -------- Literal blocks {{{ ... }}} --------
      if (isLiteralBlockNode(node)) {
        flushParagraph(blocks, currentInlines);

        const text = normaliseText(node.content);
        const detected = detectBlockType(text);

        blocks.push({
          kind: "literal",
          text,
          detectedType: detected.type,
          confidence: detected.confidence,
        });

        ctx.diagnostics.push({
          severity: "info",
          message: `docgen: block detected=${detected.type} confidence=${detected.confidence.toFixed(2)}`,
        });

        continue;
      }
    }

    flushParagraph(blocks, currentInlines);

    const ir: DocIR = { entryFile: entry, blocks };
    ctx.artifacts.add({
      type: "docgen/ir",
      data: ir,
      sourceFile: entry,
    });

    ctx.diagnostics.push({
      severity: "info",
      message: `docgen: built IR with ${blocks.length} block(s)`,
    });
  },
};

export default plugin;
export type { DocIR, Block, Inline } from "./ir";
