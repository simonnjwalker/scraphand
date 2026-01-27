// modules/sh1-cite/src/csl/types.ts
/**
 * Minimal CSL-JSON types for sh1-cite.
 *
 * NOTE:
 * - Keys like "publisher-place" and "container-title" must be quoted in TS.
 * - This file is intentionally permissive: it allows extra CSL fields via an index signature.
 */

export type CSLDate = {
  "date-parts"?: number[][];
  literal?: string;
};

export type CSLName = {
  family?: string;
  given?: string;
  literal?: string;
};

export interface CSLItem {
  id: string;
  type: string;

  title?: string;

  author?: CSLName[];
  editor?: CSLName[];

  issued?: CSLDate;
  accessed?: CSLDate;

  publisher?: string;
  "publisher-place"?: string;

  "container-title"?: string;

  volume?: string;
  issue?: string;
  page?: string;

  DOI?: string;
  URL?: string;

  // Allow other CSL fields without exploding types
  [k: string]: unknown;
}
