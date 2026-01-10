export function splitTopLevelByComma(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0; // bracket depth for [...]
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === '"' && input[i - 1] !== "\\") {
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }

    if (!inQuotes) {
      if (ch === "[") depth++;
      if (ch === "]") depth = Math.max(0, depth - 1);

      if (ch === "," && depth === 0) {
        const trimmed = cur.trim();
        if (trimmed) out.push(trimmed);
        cur = "";
        continue;
      }
    }

    cur += ch;
  }

  const trimmed = cur.trim();
  if (trimmed) out.push(trimmed);
  return out;
}
