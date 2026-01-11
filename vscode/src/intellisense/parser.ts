// vscode/src/intellisense/parser.ts
export interface CommandToken {
  name: string;
  arg: string | null;
  startOffset: number; // points at '{'
  endOffset: number;   // points just after '}'
}

/**
 * Scan the entire document and return {command:arg} tokens,
 * skipping:
 *  - line comments //...
 *  - block comments /* ... *\/
 *  - literal blocks {{{ ... }}}
 */
export function scanCommands(text: string): CommandToken[] {
  const out: CommandToken[] = [];

  let i = 0;
  const n = text.length;

  let inLineComment = false;
  let inBlockComment = false;
  let inLiteralBlock = false;

  const startsWith = (s: string) => text.startsWith(s, i);

  while (i < n) {
    // End line comment
    if (inLineComment) {
      if (text[i] === "\n") inLineComment = false;
      i++;
      continue;
    }

    // End block comment
    if (inBlockComment) {
      if (startsWith("*/")) {
        inBlockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    // End literal block
    if (inLiteralBlock) {
      if (startsWith("}}}")) {
        inLiteralBlock = false;
        i += 3;
      } else {
        i++;
      }
      continue;
    }

    // Start comments / literal blocks
    if (startsWith("//")) {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (startsWith("/*")) {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (startsWith("{{{")) {
      inLiteralBlock = true;
      i += 3;
      continue;
    }

    // Detect a {command:arg} token in normal code
    if (text[i] === "{") {
      const start = i;
      i++; // after '{'

      // Parse command name: [A-Za-z_][A-Za-z0-9_-]*
      const nameStart = i;
      if (!isNameStart(text[i])) {
        // not a command block
        i = start + 1;
        continue;
      }
      i++;
      while (i < n && isNameChar(text[i])) i++;
      const name = text.slice(nameStart, i);

      // Parse optional ":arg"
      let arg: string | null = null;
      if (i < n && text[i] === ":") {
        i++;
        const argStart = i;
        // arg runs until the matching '}' (we keep it simple: no nested braces)
        while (i < n && text[i] !== "}") i++;
        arg = text.slice(argStart, i).trim();
      } else {
        // no ":"; consume until '}' if present
        while (i < n && text[i] !== "}") i++;
      }

      if (i < n && text[i] === "}") {
        i++; // include '}'
        out.push({ name, arg, startOffset: start, endOffset: i });
        continue;
      }

      // Unclosed: bail out safely
      i = start + 1;
      continue;
    }

    i++;
  }

  return out;
}

function isNameStart(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z_]/.test(ch);
}
function isNameChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_-]/.test(ch);
}


// Parses: {define:h1,doc="Heading 1",args="text"}
// Accepts either just a name, or name + comma-separated k=v metadata.
// Returns { definedName, doc?, args? }
export function parseDefineArg(arg: string | null): {
  definedName: string | null;
  doc?: string;
  args?: string;
} {
  if (!arg) return { definedName: null };

  // split first token as name, remaining as comma-separated metadata
  // Example: "h1,doc="Heading 1",args=text"
  const parts = splitTopLevelCommas(arg);
  const namePart = (parts.shift() ?? "").trim();
  const definedName = namePart.length ? namePart : null;

  const meta: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    const v = unquote(p.slice(eq + 1).trim());
    meta[k] = v;
  }

  return { definedName, doc: meta.doc, args: meta.args };
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== "\\") inQuotes = !inQuotes;

    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }

  if (cur.trim()) out.push(cur.trim());
  return out;
}

function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"');
  }
  return s;
}
