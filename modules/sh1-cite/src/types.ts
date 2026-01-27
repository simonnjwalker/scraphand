import type { DocIR as DocgenIR } from "sh1-docgen";

/**
 * Stage 1 approach: we *do not* change sh1-docgen’s IR types yet.
 * We define an “extended IR” shape used by sh1-cite and emitted as a new artefact type.
 */

export type CitationMode = "author-date"; // future: numeric, footnote, etc.

export interface CitationInline {
  kind: "citation";
  key: string;
  locator?: string;
  text?: string;
}


export type CiteAwareInline = any | CitationInline; // keep loose for now

export interface CiteAwareDocIR extends Omit<DocgenIR, "blocks"> {
  blocks: any[]; // keep loose; we'll rewrite in transform.ts safely
}

export interface CSLItem {
  id: string;
  type: string; // "article-journal", etc.
  title?: string;
  author?: Array<{ family?: string; given?: string }>;
  issued?: { "date-parts": number[][] };
  issuedRaw?: string;
}
