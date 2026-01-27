// modules/sh1-cite/src/bibtex/toCsl.ts
import type { BibtexEntry } from "./parseBibtex";
import type { CSLItem, CSLName, CSLDate } from "../csl/types";

function splitAuthors(raw: string): CSLName[] {
  // Very small BibTeX author splitter: "Last, First and Last, First"
  const parts = raw
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const names: CSLName[] = [];
  for (const p of parts) {
    // "Family, Given" or "Given Family"
    const comma = p.indexOf(",");
    if (comma !== -1) {
      const family = p.slice(0, comma).trim();
      const given = p.slice(comma + 1).trim();
      names.push({ family: family || undefined, given: given || undefined });
    } else {
      names.push({ literal: p });
    }
  }
  return names;
}

function parseYear(yearText: string | undefined): CSLDate | undefined {
  const y = String(yearText ?? "").trim();
  if (!y) return undefined;
  const n = Number(y);
  if (!Number.isFinite(n)) return undefined;
  return { "date-parts": [[n]] };
}

export function bibtexEntryToCsl(e: BibtexEntry): CSLItem {
  const f = e.fields ?? {};

  const item: CSLItem = {
    id: e.id,
    type: (e.entryType || "article-journal") as string,
    title: f.title,
    author: f.author ? splitAuthors(f.author) : undefined,
    issued: parseYear(f.year),
    publisher: f.publisher,
    "publisher-place": (f as any)["publisher-place"] ?? (f as any).address,
    "container-title": (f as any)["container-title"] ?? f.journal ?? f.booktitle,
    volume: (f as any).volume,
    issue: (f as any).number ?? (f as any).issue,
    page: (f as any).pages ?? (f as any).page,
    DOI: (f as any).doi ?? (f as any).DOI,
    URL: (f as any).url ?? (f as any).URL,
  };

  return item;
}

export type { CSLItem };
