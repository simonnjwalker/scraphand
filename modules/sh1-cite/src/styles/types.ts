// modules/sh1-cite/src/styles/types.ts
import type { CSLItem } from "../csl/types";

export type CitationStyleId = "apa7" | "chicago-notes" | "aglc4";

export type StyleOptions = {
  // later: locale, disambiguation rules, et al limits, etc.
};

export type FormattedCitations = {
  style: string;
  inTextById: Record<string, string>;
  bibliography: string[];
};

export interface CitationStyle {
  id: CitationStyleId | string;
  label: string;
  format(items: CSLItem[], opts?: StyleOptions): FormattedCitations;
}
