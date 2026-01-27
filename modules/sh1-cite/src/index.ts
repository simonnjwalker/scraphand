// modules/sh1-cite/src/index.ts
import type { Plugin } from "sh1-runtime";
import type { DocIR } from "sh1-docgen";
import { ingestBibliographyBlocksToCsl } from "./ingest";
import { insertBibliographyBlocksPerInstance, transformIrForCitations } from "./transform";
import { getStyle } from "./styles";
import { detectBlockType } from "sh1-core";

export const plugin: Plugin = {
  name: "sh1-cite",
  provides: ["cite/csl-json", "cite/formatted", "cite/ir"],
  consumes: ["docgen/ir"],

  async run(ctx) {
    const irArts = ctx.artifacts.all("docgen/ir");
    if (!irArts.length) {
      ctx.diagnostics.push({
        severity: "warning",
        code: "W_CITE_NO_IR",
        message: "cite: no docgen/ir artefact found",
      });
      return;
    }

    const ir0 = irArts[0].data as DocIR;

    ctx.diagnostics.push({
      severity: "info",
      message: "CITE PLUGIN VERSION START CHECK: 2026-01-19",
    });

    // 1) ingest bib blocks (BibTeX / CSL-JSON)
    const { items, diagnostics: ingestDiags } = ingestBibliographyBlocksToCsl(ir0, {
      detectBlockType: (content: string) => detectBlockType(content),
    });
    for (const d of ingestDiags) ctx.diagnostics.push(d);

    ctx.artifacts.add({
      type: "cite/csl-json",
      data: items,
      sourceFile: ctx.entryFile,
    });

    // 2) choose style
    const defaultStyle = String((ctx.config as any)?.bibliography?.style ?? "apa7").trim() || "apa7";
    const style = getStyle(defaultStyle);

    const formatted = style.format(items);

    ctx.artifacts.add({
      type: "cite/formatted",
      data: formatted,
      sourceFile: ctx.entryFile,
    });

    ctx.diagnostics.push({
      severity: "info",
      message: `cite: formatted ${formatted.bibliography.length} item(s) as ${formatted.style}`,
    });

    // 3) citations
    const ir1 = transformIrForCitations(ir0, { inTextById: formatted.inTextById });

    // 4) bibliography placeholders (per instance)
    const bibliographyByStyle: Record<string, string[]> = {
      [formatted.style]: formatted.bibliography,
    };

    const ir2 = insertBibliographyBlocksPerInstance(ir1, {
      defaultStyle,
      bibliographyByStyle,
    });

    // pull debug counts from transform (since transform has no ctx)
    const dbg = (ir2.blocks as any).__sh1cite_debug;
    if (dbg?.found !== undefined) {
      ctx.diagnostics.push({
        severity: "info",
        message: `cite: bibliography placeholders replaced: found=${dbg.found}, filled=${dbg.filled}`,
      });
    }

    ctx.artifacts.add({
      type: "cite/ir",
      data: ir2,
      sourceFile: ctx.entryFile,
    });

    ctx.diagnostics.push({
      severity: "info",
      message: "CITE PLUGIN VERSION END CHECK: 2026-01-19",
    });
  },
};

export default plugin;
