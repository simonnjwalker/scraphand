// modules/sh1-cite/src/format/index.ts
import type { CSLItem } from "../csl/types";
import type { CitationStyle } from "./apa7";
import { apa7 } from "./apa7";

const STYLES: Record<string, CitationStyle> = {
  apa7,
};

export function getStyle(styleId: string | undefined | null): CitationStyle {
  const key = String(styleId ?? "apa7").toLowerCase().trim();
  return STYLES[key] ?? apa7;
}

// Convenience re-export (optional)
export type { CSLItem };
