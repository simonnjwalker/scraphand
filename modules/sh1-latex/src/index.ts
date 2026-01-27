// modules/sh1-latex/src/index.ts
import type { Plugin } from "sh1-runtime";
import type { DocIR, Block } from "sh1-docgen";
import { detectBlockType } from "sh1-core";

import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

import { Resvg } from "@resvg/resvg-js";
import crypto from "node:crypto";
import path from "node:path";

type LatexMapEntry = {
  blockIndex: number;
  relPath: string;
  display: boolean; // false => inline ($...$); true => block ($$...$$)
};

function hashText(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

function parseLatexDelimiters(raw: string): { latex: string; display: boolean } {
  const t = raw.trim();
  if (!t) return { latex: "", display: true };

  // Block math
  if (t.startsWith("$$") && t.endsWith("$$") && t.length >= 4) {
    return { latex: t.slice(2, -2).trim(), display: true };
  }
  if (t.startsWith("\\[") && t.endsWith("\\]") && t.length >= 4) {
    return { latex: t.slice(2, -2).trim(), display: true };
  }

  // Inline math
  if (t.startsWith("$") && t.endsWith("$") && t.length >= 2 && !t.startsWith("$$")) {
    return { latex: t.slice(1, -1).trim(), display: false };
  }
  if (t.startsWith("\\(") && t.endsWith("\\)") && t.length >= 4) {
    return { latex: t.slice(2, -2).trim(), display: false };
  }

  // Default for literal blocks: display math
  return { latex: t, display: true };
}

// Initialise MathJax once
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const tex = new TeX({ packages: AllPackages });
const svg = new SVG({ fontCache: "none" });

const html = mathjax.document("", { InputJax: tex, OutputJax: svg });


// --- helpers: find the first <svg> node inside MathJax output ---
function findFirstSvgNode(root: any): any | null {
  try {
    // liteAdaptor exposes kind() + childNodes()
    if (adaptor.kind(root) === "svg") return root;

    const kids = adaptor.childNodes(root) ?? [];
    for (const k of kids) {
      const found = findFirstSvgNode(k);
      if (found) return found;
    }
  } catch {
    // ignore and fall through
  }
  return null;
}

function latexToSvg(latex: string): string {
  // display math by default for block usage
  const node = html.convert(latex, { display: true });

  // MathJax often returns <mjx-container> wrapping the <svg>.
  // Resvg needs the string to start with <svg ...>.
  const svgNode = findFirstSvgNode(node);

  if (!svgNode) {
    const preview = adaptor.outerHTML(node).slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`MathJax did not produce an <svg> root. Preview: ${preview}`);
  }

  const svgText = adaptor.outerHTML(svgNode);

  // Optional: ensure xmlns is present (usually is, but harmless safeguard)
  if (!/xmlns=/.test(svgText)) {
    return svgText.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return svgText;
}



function svgToPngBytes(svgText: string): Uint8Array {
  const r = new Resvg(svgText, { fitTo: { mode: "original" } });
  return r.render().asPng();
}

function isLiteralBlock(b: Block): b is Extract<Block, { kind: "literal" }> {
  return b.kind === "literal";
}



const plugin: Plugin = {
  name: "sh1-latex",
  consumes: ["docgen/ir"],
  provides: ["latex/png", "latex/map"],
  async run(ctx) {
    const irArts = ctx.artifacts.all("docgen/ir");
    if (!irArts.length) {
      ctx.diagnostics.push({
        severity: "warning",
        code: "W_LATEX_NO_IR",
        message: "latex: no docgen/ir artefact found",
      });
      return;
    }

    const ir = irArts[0].data as DocIR;

    const map: LatexMapEntry[] = [];

    let seenLatex = 0;
    let produced = 0;

    for (let i = 0; i < ir.blocks.length; i++) {
      const b = ir.blocks[i];
      if (!isLiteralBlock(b)) continue;

      // Prefer docgen detection; fallback to core detection
      const detected = b.detectedType ?? detectBlockType(b.text).type;
      if (detected !== "latex") continue;

      const parsed = parseLatexDelimiters(b.text);
      if (!parsed.latex) continue;

      seenLatex++;

      let svgText: string;
      try {
        svgText = latexToSvg(parsed.latex);
      } catch (e: any) {
        ctx.diagnostics.push({
          severity: "error",
          code: "E_LATEX_MATHJAX",
          message: `latex: MathJax failed: ${String(e?.message ?? e)}`,
        });
        continue;
      }

      let pngBytes: Uint8Array;
      try {
        pngBytes = svgToPngBytes(svgText);
      } catch (e: any) {
        // (keep this; it's a useful error surface)
        ctx.diagnostics.push({
          severity: "error",
          code: "E_LATEX_RESVG",
          message: `latex: SVG->PNG failed: ${String(e?.message ?? e)}`,
        });
        continue;
      }

      const fileName = `latex-${hashText(parsed.latex)}.png`;
      const rel = path.posix.join("out", "assets", "latex", fileName);
      const abs = ctx.host.resolveOutputPath(rel);

      await ctx.host.writeBinaryFile(abs, pngBytes);

      map.push({ blockIndex: i, relPath: rel, display: parsed.display });
      produced++;

      ctx.artifacts.add({
        type: "latex/png",
        data: { path: rel, display: parsed.display },
        sourceFile: ctx.entryFile,
      });

      ctx.diagnostics.push({
        severity: "info",
        message: `latex: wrote ${abs}`,
      });
    }

    ctx.diagnostics.push({
      severity: "info",
      message: `latex: detected ${seenLatex} latex block(s), produced ${produced} image(s)`,
    });

    ctx.artifacts.add({
      type: "latex/map",
      data: map,
      sourceFile: ctx.entryFile,
    });
  },
};

export default plugin;
