import type { CSLItem } from "./types";

export function buildStubCslJson(keys: string[]): CSLItem[] {
  const uniq = [...new Set(keys)].sort((a, b) => a.localeCompare(b));

  return uniq.map((id) => ({
    id,
    type: "article-journal",
    title: undefined,
    author: undefined,
    issued: undefined,
    issuedRaw: undefined,
  }));
}
