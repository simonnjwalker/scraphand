import { ConfigAssignment, ConfigOp, ConfigValue, ConfigObject } from "./types";
import { splitTopLevelByComma } from "./split";

const OPS: ConfigOp[] = ["!=", "+=", "-=", "="]; // longest-first matching

function parsePath(p: string): string[] {
  const path = p.trim();
  if (!path) return [];
  return path.split(".").map((s) => s.trim()).filter(Boolean);
}

function parseScalar(raw: string): ConfigValue {
  const s = raw.trim();

  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;

  // number
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  // quoted string
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"');
  }

  return s;
}

// [k=v,k2=v2] object literal
function parseBracketObject(raw: string): ConfigObject {
  const s = raw.trim();
  if (!(s.startsWith("[") && s.endsWith("]"))) {
    throw new Error(`Expected [...] object, got: ${raw}`);
  }

  const inner = s.slice(1, -1).trim();
  if (!inner) return {};

  const parts = splitTopLevelByComma(inner);
  const obj: ConfigObject = {};

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      // allow bare flags later; for now treat as string true
      obj[part.trim()] = true;
      continue;
    }

    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    obj[k] = parseScalar(v);
  }

  return obj;
}

function parseValue(raw: string): ConfigValue {
  const s = raw.trim();
  if (!s) return "";

  if (s.startsWith("[") && s.endsWith("]")) {
    return parseBracketObject(s);
  }

  return parseScalar(s);
}

export function parseConfigPayload(payload: string): ConfigAssignment[] {
  const clauses = splitTopLevelByComma(payload.trim());
  const out: ConfigAssignment[] = [];

  for (const clause of clauses) {
    let opFound: ConfigOp | null = null;
    let opIndex = -1;

    for (const op of OPS) {
      const idx = clause.indexOf(op);
      if (idx !== -1) {
        opFound = op;
        opIndex = idx;
        break;
      }
    }

    // If there's no operator, ignore (or error later)
    if (!opFound) continue;

    const left = clause.slice(0, opIndex).trim();
    const right = clause.slice(opIndex + opFound.length).trim();

    const path = parsePath(left);
    if (!path.length) continue;

    if (opFound === "!=" && right.length === 0) {
      out.push({ path, op: "!=" });
      continue;
    }

    out.push({
      path,
      op: opFound,
      value: parseValue(right),
    });
  }

  return out;
}
