// modules/sh1-html/src/index.ts
import type { Plugin, OutputSpec } from "sh1-runtime";
import type { DocIR, Block, Inline } from "sh1-docgen";
import path from "node:path";

type LatexMapEntry = { blockIndex: number; relPath: string };

type RenderTagMode = "render" | "show-only" | "show-and-render";
type RenderTagOptions = {
  mode: RenderTagMode;
  showCore: boolean;
  unknownOnly: boolean;
};

const CORE_TAGS = new Set(["import", "define", "config"]);
const KNOWN_RENDER_TAGS = new Set(["b", "i", "u"]); // docgen’s inline markup kinds

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

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}
function posixDir(p: string): string {
  return path.posix.dirname(toPosix(p));
}
function relFromHtmlToAsset(htmlRelPath: string, assetRelPath: string): string {
  const fromDir = posixDir(htmlRelPath);
  const rel = path.posix.relative(fromDir, toPosix(assetRelPath));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCoreTagName(name: string): boolean {
  return CORE_TAGS.has(name);
}

function isKnownTagName(name: string): boolean {
  if (CORE_TAGS.has(name)) return true;
  if (KNOWN_RENDER_TAGS.has(name)) return true;
  // “cite” is represented as kind:"citation" (not rawCommand), but treat it as known for filtering.
  if (name === "cite" || name === "bibliography") return true;
  // Headings etc aren’t “tags” at render time; they’re blocks already.
  return false;
}

/**
 * Decide how to treat a tag-like thing (rawCommand / b / i / u / citation).
 * Returns:
 *  - showTag: whether to show the literal {tag:...} wrapper
 *  - renderTag: whether to render the semantic effect (bold/italics/etc)
 */
function decideTagBehaviour(
  opts: RenderTagOptions,
  tagName: string,
  known: boolean
): { showTag: boolean; renderTag: boolean } {
  // Core tag visibility only matters when “showing” tags.
  const core = isCoreTagName(tagName);

  // In pure render mode, never show tag text; just render semantics where possible.
  if (opts.mode === "render") {
    return { showTag: false, renderTag: true };
  }

  // In show-only mode, default is: show tags and do NOT render semantics.
  // If unknownOnly=true, then *only unknown tags* are shown; known tags render normally.
  if (opts.mode === "show-only") {
    if (core && !opts.showCore) return { showTag: false, renderTag: false }; // core tags disappear
    if (opts.unknownOnly && known) return { showTag: false, renderTag: true }; // known tags render normally
    return { showTag: true, renderTag: false }; // show the tag text, don’t render effect
  }

  // show-and-render: show tag wrappers, and ALSO render semantics.
  // If unknownOnly=true, only show wrappers for unknown tags; still render all.
  if (opts.mode === "show-and-render") {
    if (core && !opts.showCore) return { showTag: false, renderTag: true }; // hide core wrapper, still render
    if (opts.unknownOnly && known) return { showTag: false, renderTag: true }; // don’t show wrapper for known
    return { showTag: true, renderTag: true };
  }

  return { showTag: false, renderTag: true };
}

function showTagWrapperHtml(tagName: string, arg: string): { open: string; close: string } {
  const argPart = arg.length ? `:${escapeHtml(arg)}` : "";
  const open = `<span class="sh1-tag">{${escapeHtml(tagName)}${argPart}}</span>`;
  // Close brace only (keeps it readable when wrapping rendered inner content)
  const close = `<span class="sh1-tag">}</span>`;
  return { open, close };
}

function renderInline(i: Inline | any, opts: RenderTagOptions): string {
  switch (i.kind) {
    case "text":
      return escapeHtml(i.text);

    case "b":
    case "i":
    case "u": {
      const tagName = i.kind as string;
      const known = true;
      const { showTag, renderTag } = decideTagBehaviour(opts, tagName, known);

      const innerText = String(i.text ?? "");
      const rendered =
        i.kind === "b"
          ? `<strong>${escapeHtml(innerText)}</strong>`
          : i.kind === "i"
          ? `<em>${escapeHtml(innerText)}</em>`
          : `<u>${escapeHtml(innerText)}</u>`;

      if (!renderTag) {
        // show-only (or hidden wrappers): show literal tag instead of formatting
        if (showTag) return `<span class="sh1-tag">{${escapeHtml(tagName)}:${escapeHtml(innerText)}}</span>`;
        return escapeHtml(innerText);
      }

      if (!showTag) return rendered;

      const w = showTagWrapperHtml(tagName, "");
      // Wrap rendered inner with tag marker + closing brace
      return `${w.open}${rendered}${w.close}`;
    }

    case "citation": {
      // sh1-cite injects: { kind:"citation", key, locator?, formatted? }
      const key = String(i.key ?? "");
      const locator = i.locator ? `, ${String(i.locator)}` : "";
      const formatted = i.formatted ? String(i.formatted) : "";
      const txt = formatted || `(${key}${locator})`;

      const tagName = "cite";
      const known = true;
      const { showTag, renderTag } = decideTagBehaviour(opts, tagName, known);

      const rendered = `<span class="sh1-cite">${escapeHtml(txt)}</span>`;

      if (!renderTag) {
        if (showTag) return `<span class="sh1-tag">{cite:${escapeHtml(key)}${escapeHtml(locator ? `, ${locator.trim().slice(1)}` : "")}}</span>`;
        return escapeHtml(txt);
      }

      if (!showTag) return rendered;

      const w = showTagWrapperHtml("cite", key + (i.locator ? `, ${String(i.locator)}` : ""));
      return `${w.open}${rendered}${w.close}`;
    }

    case "rawCommand": {
      const name = String(i.name ?? "");
      const arg = String(i.arg ?? "");
      const known = isKnownTagName(name);
      const { showTag, renderTag } = decideTagBehaviour(opts, name, known);

      // rawCommand has no semantic render in HTML yet, so “render” just hides it.
      if (!showTag) return renderTag ? "" : "";

      return `<span class="sh1-tag">{${escapeHtml(name)}${arg.length ? `:${escapeHtml(arg)}` : ""}}</span>`;
    }

    default:
      // If future kinds appear, show something visible rather than crashing
      return `<span class="sh1-unknown-inline">${escapeHtml(String(i.kind ?? "unknown"))}</span>`;
  }
}

function renderBibliographyBlock(b: any): string {
  const title = (String(b.title ?? "Bibliography")).trim() || "Bibliography";
  const entries = Array.isArray(b.entries) ? b.entries : [];

  const lis = entries.map((e: any) => `<li>${escapeHtml(String(e))}</li>`).join("\n");
  return `
<section class="sh1-bibliography">
  <h2>${escapeHtml(title)}</h2>
  <ol>
    ${lis}
  </ol>
</section>`.trim();
}

function renderHtmlDoc(ir: DocIR, latexMap: LatexMapEntry[] | null, htmlRelPath: string, ctx: any): string {
  const opts = getRenderTagOptions(ctx);

  const latexByBlockIndex = new Map<number, string>();
  if (Array.isArray(latexMap)) {
    for (const e of latexMap) {
      latexByBlockIndex.set(e.blockIndex, relFromHtmlToAsset(htmlRelPath, e.relPath));
    }
  }

  const body = ir.blocks
    .map((b: any, idx: number) => {
      if (b.kind === "bibliography") return renderBibliographyBlock(b);

      if (b.kind === "heading") {
        const level = Math.min(Math.max(b.level, 1), 5);
        const tag = `h${level}`;
        const inner = b.inlines.map((x: any) => renderInline(x, opts)).join("");
        return `<${tag}>${inner}</${tag}>`;
      }

      if (b.kind === "paragraph") {
        const inner = b.inlines.map((x: any) => renderInline(x, opts)).join("");
        return `<p>${inner}</p>`;
      }

      if (b.kind === "literal") {
        const src = latexByBlockIndex.get(idx);
        if (src) {
          return `<div class="sh1-latex"><img src="${escapeHtml(src)}" alt="LaTeX"/></div>`;
        }
        const cls = `sh1-literal sh1-${escapeHtml(String(b.detectedType))}`;
        return `<pre class="${cls}"><code>${escapeHtml(String(b.text ?? ""))}</code></pre>`;
      }

      return `<div class="sh1-unknown-block">${escapeHtml(String(b.kind ?? "unknown"))}</div>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scraphand</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    pre.sh1-literal { padding: 1rem; overflow-x: auto; }
    .sh1-latex img { max-width: 100%; height: auto; }
    .sh1-cite { opacity: 0.9; }
    .sh1-bibliography ol { padding-left: 1.5rem; }
    .sh1-tag { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; opacity: 0.85; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

const plugin: Plugin = {
  name: "sh1-html",
  consumes: ["docgen/ir", "latex/map", "cite/ir"],
  provides: ["file/html"],
  async run(ctx) {
    const citeIr = ctx.artifacts.all("cite/ir");
    const irArtifacts = citeIr.length ? citeIr : ctx.artifacts.all("docgen/ir");

    if (!irArtifacts.length) {
      ctx.diagnostics.push({
        severity: "warning",
        code: "W_HTML_NO_IR",
        message: "html: no IR artefact found (cite/ir or docgen/ir)",
      });
      return;
    }

    const latexMapArts = ctx.artifacts.all("latex/map");
    const latexMap = latexMapArts.length ? (latexMapArts[0].data as LatexMapEntry[]) : null;

    const ir = irArtifacts[0].data as DocIR;

    const outputs = (ctx.config.outputs ?? []).filter((o: OutputSpec) => o.type === "html");
    const targets = outputs.length ? outputs.map((o) => o.path) : ["out/report.html"];

    for (const relPath of targets) {
      const html = renderHtmlDoc(ir, latexMap, relPath, ctx);

      const absPath = ctx.host.resolveOutputPath(relPath);
      await ctx.host.writeTextFile(absPath, html);

      ctx.artifacts.add({
        type: "file/html",
        data: { path: relPath, html },
        sourceFile: ctx.entryFile,
      });

      ctx.diagnostics.push({
        severity: "info",
        message: `html: wrote ${absPath}`,
      });
    }
  },
};

export default plugin;
