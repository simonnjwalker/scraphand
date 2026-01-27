// modules/sh1-cite/src/styles/chicagoNotes.ts
import type { CitationStyle, FormattedCitations } from "./types";
import type { CSLItem } from "../csl/types";

// Chicago Notes/Bibliography is complex; MVP placeholder that is still useful.
function author(it: any): string {
  const a0 = it?.author?.[0];
  const given = String(a0?.given ?? "").trim();
  const family = String(a0?.family ?? "").trim();
  const name = [given, family].filter(Boolean).join(" ").trim();
  return name || String(it?.id ?? "Unknown");
}

function title(it: any): string {
  return String(it?.title ?? "").trim() || "(untitled)";
}

function year(it: any): string {
  const issued = it?.issued?.["date-parts"];
  const y = Array.isArray(issued) && issued[0] && issued[0][0] ? String(issued[0][0]) : "";
  return y || "n.d.";
}

export const chicagoNotes: CitationStyle = {
  id: "chicago-notes",
  label: "Chicago Notes/Bibliography (MVP)",
  format(items: CSLItem[]): FormattedCitations {
    const inTextById: Record<string, string> = {};
    const bibliography: string[] = [];

    for (const it of items) {
      const id = String((it as any)?.id ?? "");
      if (!id) continue;

      // In-text for Chicago NB is usually a note marker; MVP: show (Author Year)
      inTextById[id] = `(${author(it)} ${year(it)})`;

      bibliography.push(`${author(it)}. "${title(it)}." (${year(it)}).`);
    }

    return { style: "chicago-notes", inTextById, bibliography };
  },
};
