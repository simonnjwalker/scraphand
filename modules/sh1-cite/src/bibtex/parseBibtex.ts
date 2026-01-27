export interface BibtexEntry {
  entryType: string; // article, book, inproceedings...
  id: string;        // citation key
  fields: Record<string, string>;
}

/**
 * Very small BibTeX parser (Stage 4A).
 * Supports:
 *   @type{key, field={value}, field="value", field=bare }
 *
 * Limitations (acceptable for MVP):
 * - Nested braces in values are not fully parsed (we try to preserve text).
 * - Comments/preambles are ignored.
 */
export function parseBibtex(text: string): BibtexEntry[] {
  const entries: BibtexEntry[] = [];

  // Find @type{...} blocks (non-greedy, but good enough for MVP)
  const re = /@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\}\s*(?=@|$)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const entryType = m[1].toLowerCase();
    const id = m[2].trim();
    const body = m[3];

    const fields = parseFields(body);
    if (!id) continue;

    entries.push({ entryType, id, fields });
  }

  return entries;
}

function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};

  // Split by commas at “top level” (rough; OK for MVP)
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (ch === '"' && body[i - 1] !== "\\") inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === "{") depth++;
      if (ch === "}") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        parts.push(cur);
        cur = "";
        continue;
      }
    }

    cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;

    const rawKey = p.slice(0, idx).trim().toLowerCase();
    const rawVal = p.slice(idx + 1).trim();

    if (!rawKey) continue;
    const val = normaliseBibtexValue(rawVal);
    if (val) fields[rawKey] = val;
  }

  return fields;
}

function normaliseBibtexValue(v: string): string {
  let s = v.trim();

  // Remove trailing commas/spaces
  s = s.replace(/,\s*$/, "").trim();

  // Strip outer braces or quotes
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1);
  }

  // Collapse whitespace
  s = s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  return s;
}
