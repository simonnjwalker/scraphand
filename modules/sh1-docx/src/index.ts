// modules/sh1-docx/src/index.ts
import type { Plugin, OutputSpec } from "sh1-runtime";
import type { DocIR, Block, Inline } from "sh1-docgen";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from "docx";

type LatexMapEntry = { blockIndex: number; relPath: string };

type RenderTagMode = "render" | "show-only" | "show-and-render";
type RenderTagOptions = {
  mode: RenderTagMode;
  showCore: boolean;
  unknownOnly: boolean;
};

const CORE_TAGS = new Set(["import", "define", "config"]);
const KNOWN_RENDER_TAGS = new Set(["b", "i", "u"]);

function getRenderTagOptions(ctx: any): RenderTagOptions {
  const cfg = (ctx?.config ?? {}) as any;
  const r = (cfg?.render ?? {}) as any;
  const tag = (r?.tag ?? {}) as any;

  const modeRaw = String(tag?.mode ?? "render").trim().toLowerCase();
  const mode: RenderTagMode =
    modeRaw === "show-only" ? "show-only" : modeRaw === "show-and-render" ? "show-and-render" : "render";

  const showCore = tag?.showCore === false ? false : true;
  const unknownOnly = tag?.unknownOnly === true;

  return { mode, showCore, unknownOnly };
}

function isCoreTagName(name: string): boolean {
  return CORE_TAGS.has(name);
}

function isKnownTagName(name: string): boolean {
  if (CORE_TAGS.has(name)) return true;
  if (KNOWN_RENDER_TAGS.has(name)) return true;
  if (name === "cite" || name === "bibliography") return true;
  return false;
}

function decideTagBehaviour(
  opts: RenderTagOptions,
  tagName: string,
  known: boolean
): { showTag: boolean; renderTag: boolean } {
  const core = isCoreTagName(tagName);

  if (opts.mode === "render") return { showTag: false, renderTag: true };

  if (opts.mode === "show-only") {
    if (core && !opts.showCore) return { showTag: false, renderTag: false };
    if (opts.unknownOnly && known) return { showTag: false, renderTag: true };
    return { showTag: true, renderTag: false };
  }

  if (opts.mode === "show-and-render") {
    if (core && !opts.showCore) return { showTag: false, renderTag: true };
    if (opts.unknownOnly && known) return { showTag: false, renderTag: true };
    return { showTag: true, renderTag: true };
  }

  return { showTag: false, renderTag: true };
}

function tagRunsOpen(tagName: string, arg: string): TextRun[] {
  const argPart = arg.length ? `:${arg}` : "";
  return [new TextRun({ text: `{${tagName}${argPart}` })];
}
function tagRunsClose(): TextRun[] {
  return [new TextRun({ text: "}" })];
}

function inlineToRuns(i: Inline | any, opts: RenderTagOptions): TextRun[] {
  switch (i.kind) {
    case "text":
      return [new TextRun({ text: i.text })];

    case "b":
    case "i":
    case "u": {
      const tagName = i.kind as string;
      const known = true;
      const { showTag, renderTag } = decideTagBehaviour(opts, tagName, known);

      const txt = String(i.text ?? "");

      if (!renderTag) {
        if (showTag) return [new TextRun({ text: `{${tagName}:${txt}}` })];
        return [new TextRun({ text: txt })];
      }

      const inner =
        i.kind === "b"
          ? [new TextRun({ text: txt, bold: true })]
          : i.kind === "i"
          ? [new TextRun({ text: txt, italics: true })]
          : [new TextRun({ text: txt, underline: {} })];

      if (!showTag) return inner;

      return [...tagRunsOpen(tagName, ""), ...inner, ...tagRunsClose()];
    }

    case "citation": {
      const key = String(i.key ?? "");
      const locator = i.locator ? `, ${String(i.locator)}` : "";
      const formatted = i.formatted ? String(i.formatted) : "";
      const txt = formatted || `(${key}${locator})`;

      const tagName = "cite";
      const known = true;
      const { showTag, renderTag } = decideTagBehaviour(opts, tagName, known);

      if (!renderTag) {
        if (showTag) return [new TextRun({ text: `{cite:${key}${locator ? `, ${String(i.locator)}` : ""}}` })];
        return [new TextRun({ text: txt })];
      }

      const inner = [new TextRun({ text: txt })];
      if (!showTag) return inner;

      return [...tagRunsOpen("cite", key + (i.locator ? `, ${String(i.locator)}` : "")), ...inner, ...tagRunsClose()];
    }

    case "rawCommand": {
      const name = String(i.name ?? "");
      const arg = String(i.arg ?? "");
      const known = isKnownTagName(name);
      const { showTag, renderTag } = decideTagBehaviour(opts, name, known);

      // rawCommand has no semantic render in DOCX; “render” hides it.
      if (!showTag) return renderTag ? [] : [];
      return [new TextRun({ text: `{${name}${arg.length ? `:${arg}` : ""}}` })];
    }

    default:
      return [new TextRun({ text: `[${String(i.kind ?? "unknown")}]` })];
  }
}

function paragraphFromInlines(inlines: Inline[], opts: RenderTagOptions): Paragraph {
  const children: TextRun[] = [];
  for (const i of inlines) children.push(...inlineToRuns(i, opts));
  return new Paragraph({ children });
}

function headingLevel(n: number) {
  if (n <= 1) return HeadingLevel.HEADING_1;
  if (n === 2) return HeadingLevel.HEADING_2;
  if (n === 3) return HeadingLevel.HEADING_3;
  if (n === 4) return HeadingLevel.HEADING_4;
  return HeadingLevel.HEADING_5;
}

async function buildDocxBytes(ctx: any, ir: DocIR, latexMap: LatexMapEntry[] | null): Promise<Uint8Array> {
  const opts = getRenderTagOptions(ctx);

  const latexRelByIndex = new Map<number, string>();
  if (Array.isArray(latexMap)) {
    for (const e of latexMap) latexRelByIndex.set(e.blockIndex, e.relPath);
  }

  const latexBytesByIndex = new Map<number, Uint8Array>();

  async function latexImageRunsForBlockIndex(idx: number): Promise<ImageRun[] | null> {
    const rel = latexRelByIndex.get(idx);
    if (!rel) return null;

    let cached = latexBytesByIndex.get(idx);
    if (!cached) {
      const abs = ctx.host.resolveOutputPath(rel);
      const read = await ctx.host.readBinaryFile(abs);
      if (!(read instanceof Uint8Array)) return null;
      latexBytesByIndex.set(idx, read);
      cached = read;
    }

    const data: Uint8Array = cached;

    return [
      new ImageRun({
        type: "png",
        data,
        transformation: { width: 480, height: 120 },
      } as any),
    ];
  }

  async function blockToParagraphs(b: any, idx: number): Promise<Paragraph[]> {
    switch (b.kind) {
      case "heading": {
        const children: TextRun[] = [];
        for (const i of b.inlines) children.push(...inlineToRuns(i, opts));
        return [new Paragraph({ children, heading: headingLevel(b.level) })];
      }

      case "paragraph":
        return [paragraphFromInlines(b.inlines, opts)];

      case "bibliography": {
        const title = (String(b.title ?? "Bibliography")).trim() || "Bibliography";
        const entries = Array.isArray(b.entries) ? b.entries : [];

        const paras: Paragraph[] = [];
        paras.push(new Paragraph({ children: [new TextRun({ text: title, bold: true })] }));
        for (const e of entries) {
          paras.push(new Paragraph({ children: [new TextRun({ text: String(e) })] }));
        }
        return paras;
      }

      case "literal": {
        if (String(b.detectedType ?? "") === "latex") {
          const imgRuns = await latexImageRunsForBlockIndex(idx);
          if (imgRuns) return [new Paragraph({ children: imgRuns as any })];
        }

        const header = new Paragraph({
          children: [new TextRun({ text: `[${String(b.detectedType)}]`, bold: true })],
        });

        const lines = String(b.text ?? "").split("\n");
        const codePara = new Paragraph({
          children: lines.flatMap((line: string, iLine: number) => {
            const r: TextRun[] = [new TextRun({ text: line, font: "Consolas" })];
            if (iLine < lines.length - 1) r.push(new TextRun({ text: "\n" }));
            return r;
          }),
        });

        return [header, codePara];
      }

      default:
        return [new Paragraph({ children: [new TextRun({ text: `[${String(b.kind ?? "unknown")}]` })] })];
    }
  }

  const children: Paragraph[] = [];
  for (let i = 0; i < ir.blocks.length; i++) {
    children.push(...(await blockToParagraphs((ir.blocks as any)[i], i)));
    children.push(new Paragraph(""));
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

function docxTargets(ctx: any): string[] {
  const outputs = (ctx.config.outputs ?? []).filter((o: OutputSpec) => o.type === "docx");
  return outputs.length ? outputs.map((o: OutputSpec) => o.path) : ["out/report.docx"];
}

const plugin: Plugin = {
  name: "sh1-docx",
  consumes: ["docgen/ir", "latex/map", "cite/ir"],
  provides: ["file/docx"],
  async run(ctx) {
    const citeIr = ctx.artifacts.all("cite/ir");
    const irArtifacts = citeIr.length ? citeIr : ctx.artifacts.all("docgen/ir");

    if (!irArtifacts.length) {
      ctx.diagnostics.push({
        severity: "warning",
        code: "W_DOCX_NO_IR",
        message: "docx: no IR artefact found (cite/ir or docgen/ir)",
      });
      return;
    }

    const latexMapArts = ctx.artifacts.all("latex/map");
    const latexMap = latexMapArts.length ? (latexMapArts[0].data as LatexMapEntry[]) : null;

    const ir = irArtifacts[0].data as DocIR;
    const bytes = await buildDocxBytes(ctx, ir, latexMap);

    const targets = docxTargets(ctx);
    for (const relPath of targets) {
      const absPath = ctx.host.resolveOutputPath(relPath);
      await ctx.host.writeBinaryFile(absPath, bytes);

      ctx.artifacts.add({
        type: "file/docx",
        data: { path: relPath },
        sourceFile: ctx.entryFile,
      });

      ctx.diagnostics.push({
        severity: "info",
        message: `docx: wrote ${absPath}`,
      });
    }
  },
};

export default plugin;
