// modules/sh1-cite/src/styles/aglc4.ts
import type { CitationStyle, FormattedCitations } from "./types";
import type { CSLItem } from "../csl/types";

// AGLC is also complex; MVP placeholder.
function authorShort(it: any): string {
  const a0 = it?.author?.[0];
  const family = String(a0?.family ?? "").trim();
  return family || String(it?.id ?? "Unknown");
}

function title(it: any): string {
  return String(it?.title ?? "").trim() || "(untitled)";
}

function year(it: any): string {
  const issued = it?.issued?.["date-parts"];
  const y = Array.isArray(issued) && issued[0] && issued[0][0] ? String(issued[0][0]) : "";
  return y || "n.d.";
}

export const aglc4: CitationStyle = {
  id: "aglc4",
  label: "AGLC4 (MVP)",
  format(items: CSLItem[]): FormattedCitations {
    const inTextById: Record<string, string> = {};
    const bibliography: string[] = [];

    for (const it of items) {
      const id = String((it as any)?.id ?? "");
      if (!id) continue;

      // AGLC typically footnotes; MVP inline:
      inTextById[id] = `(${authorShort(it)} ${year(it)})`;
      bibliography.push(`${authorShort(it)}, ${title(it)} (${year(it)}).`);
    }

    return { style: "aglc4", inTextById, bibliography };
  },
};
