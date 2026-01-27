// modules/sh1-cite/src/styles/apa7.ts
import type { CitationStyle, FormattedCitations } from "./types";
import type { CSLItem } from "../csl/types";

// Very small APA-ish MVP. We’ll refine rules later.
function yearOf(item: any): string {
  const issued = item?.issued?.["date-parts"];
  const y = Array.isArray(issued) && issued[0] && issued[0][0] ? String(issued[0][0]) : "";
  return y || "n.d.";
}

function familyNameFirstAuthor(item: any): string {
  const a0 = item?.author?.[0];
  const fam = a0?.family ? String(a0.family) : "";
  return fam || String(item?.id ?? "Unknown");
}

function authorInText(item: any): string {
  const authors = item?.author;
  if (!Array.isArray(authors) || !authors.length) return String(item?.id ?? "Unknown");

  const fam0 = String(authors[0]?.family ?? "").trim();
  if (!fam0) return String(item?.id ?? "Unknown");

  if (authors.length === 1) return fam0;
  if (authors.length === 2) {
    const fam1 = String(authors[1]?.family ?? "").trim();
    return fam1 ? `${fam0} & ${fam1}` : fam0;
  }
  // 3+ authors: "Smith et al."
  return `${fam0} et al.`;
}

function titleOf(item: any): string {
  const t = String(item?.title ?? "").trim();
  return t || "(untitled)";
}

function containerTitle(item: any): string {
  const ct = String(item?.["container-title"] ?? "").trim();
  return ct;
}

function formatBibliographyEntryApa7(item: CSLItem): string {
  const a = authorInText(item);
  const y = yearOf(item);
  const title = titleOf(item);

  const ct = containerTitle(item);
  if (ct) return `${a}. (${y}). ${title}. ${ct}.`;

  return `${a}. (${y}). ${title}.`;
}

export const apa7: CitationStyle = {
  id: "apa7",
  label: "APA 7th (MVP)",
  format(items: CSLItem[]): FormattedCitations {
    const inTextById: Record<string, string> = {};
    const bibliography: string[] = [];

    for (const it of items) {
      const id = String((it as any)?.id ?? "");
      if (!id) continue;

      // In-text: (Author, Year)
      const inText = `(${authorInText(it)}, ${yearOf(it)})`;
      inTextById[id] = inText;

      bibliography.push(formatBibliographyEntryApa7(it));
    }

    return { style: "apa7", inTextById, bibliography };
  },
};
