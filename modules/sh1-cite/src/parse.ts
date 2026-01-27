export interface ParsedCite {
  key: string;
  locator?: string;
}

export function parseCiteArg(arg: string): ParsedCite | null {
  const raw = (arg ?? "").trim();
  if (!raw) return null;

  // Split by commas: key, p=12, loc=...
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;

  const key = parts[0];
  if (!key) return null;

  let locator: string | undefined;

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const eq = p.indexOf("=");
    if (eq === -1) continue;

    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();

    if (k === "p" || k === "loc" || k === "locator") {
      locator = v;
    }
  }

  return { key, locator };
}
