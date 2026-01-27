// modules/sh1-cite/src/transform.ts
import type { DocIR, Block, Inline } from "sh1-docgen";

type BibliographyPlaceholder = {
  style?: string;  // "apa7"
  title?: string;  // optional
};

function isWhitespaceTextInline(i: Inline): boolean {
  return i.kind === "text" && i.text.trim().length === 0;
}

function getMeaningfulInlines(inlines: Inline[]): Inline[] {
  return inlines.filter((i) => !isWhitespaceTextInline(i));
}

function parseKeyValueArg(arg: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = (arg ?? "").trim();
  if (!s) return out;

  // split by commas (simple; ok for MVP)
  for (const part of s.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf("=");
    if (eq === -1) {
      // bare value: treat as style/type if nothing else
      if (!out.type && !out.style) out.type = p;
      continue;
    }
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

function bibliographyPlaceholderFromParagraph(b: Extract<Block, { kind: "paragraph" }>): BibliographyPlaceholder | null {
  const inls = getMeaningfulInlines(b.inlines);
  if (inls.length !== 1) return null;

  const only = inls[0];
  if (only.kind !== "rawCommand") return null;
  if (only.name !== "bibliography") return null;

  const kv = parseKeyValueArg(only.arg ?? "");
  const style = (kv.type || kv.style || "").trim() || undefined;
  const title = (kv.title || "").trim() || undefined;

  return { style, title };
}

function parseCitationArg(arg: string): { key: string; locator?: string } {
  const s = (arg ?? "").trim();
  if (!s) return { key: "" };

  // supports:
  //   cite:Key
  //   cite:Key,p=12
  //   cite:Key,locator=12
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  const key = parts[0] ?? "";
  let locator: string | undefined;

  for (const p of parts.slice(1)) {
    const [k, v] = p.split("=").map((x) => x.trim());
    if (!k || !v) continue;
    if (k === "p" || k === "locator") locator = v;
  }

  return { key, locator };
}

export function transformIrForCitations(
  ir: DocIR,
  opts: { inTextById: Record<string, string> }
): DocIR {
  const outBlocks: Block[] = [];

  for (const b of ir.blocks) {
    if (b.kind !== "paragraph") {
      outBlocks.push(b);
      continue;
    }

    const outInlines: Inline[] = [];

    for (const i of b.inlines) {
      if (i.kind !== "rawCommand" || i.name !== "cite") {
        outInlines.push(i);
        continue;
      }

      const { key, locator } = parseCitationArg(i.arg);
      if (!key) {
        outInlines.push(i);
        continue;
      }

      const formatted = opts.inTextById[key];
      outInlines.push({
        kind: "citation",
        key,
        locator,
        formatted,
      });
    }

    outBlocks.push({ ...b, inlines: outInlines });
  }

  return { ...ir, blocks: outBlocks };
}

export function insertBibliographyBlocksPerInstance(
  ir: DocIR,
  opts: {
    defaultStyle: string;
    bibliographyByStyle: Record<string, string[]>; // styleId -> formatted lines
  }
): DocIR {
  const out: Block[] = [];

  let found = 0;
  let filled = 0;

  for (const b of ir.blocks) {
    if (b.kind !== "paragraph") {
      out.push(b);
      continue;
    }

    const ph = bibliographyPlaceholderFromParagraph(b);
    if (!ph) {
      out.push(b);
      continue;
    }

    found++;

    const style = (ph.style ?? opts.defaultStyle).trim();
    const entries = opts.bibliographyByStyle[style] ?? [];

    if (entries.length) filled++;

    out.push({
      kind: "bibliography",
      style,
      title: ph.title ?? "Bibliography",
      entries,
    });
  }

  // note: no ctx here; caller logs these counts
  (out as any).__sh1cite_debug = { found, filled };

  return { ...ir, blocks: out };
}
