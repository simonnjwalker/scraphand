// modules/sh1-cite/src/ingest.ts
import type { Diagnostic } from "sh1-runtime";
import type { DocIR, Block } from "sh1-docgen";
import { parseBibtex } from "./bibtex/parseBibtex";
import { bibtexEntryToCsl, type CSLItem } from "./bibtex/toCsl";

export function ingestBibliographyBlocksToCsl(
  ir: DocIR,
  opts: { detectBlockType: (content: string) => { type: string; confidence: number; reason?: string } }
): { items: CSLItem[]; diagnostics: Diagnostic[] } {
  const items: CSLItem[] = [];
  const diagnostics: Diagnostic[] = [];

  let bibtexBlocks = 0;

  for (const b of ir.blocks as any[]) {
    if (b?.kind !== "literal") continue;

    const text = String(b.text ?? "");
    const detected = b.detectedType ? { type: String(b.detectedType), confidence: Number(b.confidence ?? 0) } : opts.detectBlockType(text);

    if (detected.type === "bibtex") {
      bibtexBlocks++;

      const entries = parseBibtex(text); // <- BibtexEntry from parseBibtex
      for (const e of entries) {
        try {
          items.push(bibtexEntryToCsl(e));
        } catch (err: any) {
          diagnostics.push({
            severity: "warning",
            code: "W_BIBTEX_TO_CSL",
            message: `cite: failed to convert BibTeX entry "${String((e as any)?.id ?? "")}": ${String(err?.message ?? err)}`,
          });
        }
      }
    }

    // (Optional future) support CSL-JSON literal blocks here
  }

  if (bibtexBlocks) {
    diagnostics.push({
      severity: "info",
      message: `cite: ingested ${bibtexBlocks} BibTeX block(s) from {{{ }}}`,
    });
  }

  return { items, diagnostics };
}
