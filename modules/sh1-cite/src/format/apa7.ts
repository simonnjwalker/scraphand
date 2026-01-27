// modules/sh1-cite/src/format/apa7.ts
import type { CSLItem, CSLName } from "../csl/types";

export type FormattedCitations = {
  style: string;
  inTextById: Record<string, string>;
  bibliography: string[];
};

export type CitationStyle = {
  id: string;
  label: string;
  format(items: CSLItem[]): FormattedCitations;
};

function yearOf(item: CSLItem): string {
  const issued: any = item?.issued as any;
  const parts = issued?.["date-parts"];
  const y = Array.isArray(parts) && parts[0] && parts[0][0] ? String(parts[0][0]) : "";
  return y || "n.d.";
}

function authorFamilies(item: CSLItem): string[] {
  const authors = item?.author;
  if (!Array.isArray(authors)) return [];
  return authors
    .map((a: CSLName) => String((a as any)?.family ?? "").trim())
    .filter((s) => s.length > 0);
}

function authorInText(item: CSLItem): string {
  const fams = authorFamilies(item);
  if (!fams.length) return String(item?.id ?? "Unknown");

  if (fams.length === 1) return fams[0];
  if (fams.length === 2) return `${fams[0]} & ${fams[1]}`;
  return `${fams[0]} et al.`;
}

function titleOf(item: CSLItem): string {
  const t = String(item?.title ?? "").trim();
  return t || "(untitled)";
}

function containerTitle(item: CSLItem): string {
  const ct = String((item as any)?.["container-title"] ?? "").trim();
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

      inTextById[id] = `(${authorInText(it)}, ${yearOf(it)})`;
      bibliography.push(formatBibliographyEntryApa7(it));
    }

    return { style: "apa7", inTextById, bibliography };
  },
};
