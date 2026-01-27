// modules/sh1-cite/src/styles/index.ts
import type { CitationStyle, CitationStyleId } from "./types";
import { apa7 } from "./apa7";
import { chicagoNotes } from "./chicagoNotes";
import { aglc4 } from "./aglc4";

const STYLES: Record<string, CitationStyle> = {
  [apa7.id]: apa7,
  [chicagoNotes.id]: chicagoNotes,
  [aglc4.id]: aglc4,
};

export function getStyle(id: string | undefined | null): CitationStyle {
  const key = String(id ?? "apa7").trim().toLowerCase();
  return STYLES[key] ?? apa7;
}

export function listStyles(): Array<{ id: string; label: string }> {
  return Object.values(STYLES).map((s) => ({ id: String(s.id), label: s.label }));
}

export type { CitationStyle, CitationStyleId };
