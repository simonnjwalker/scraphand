// A pragmatic import scanner: finds {import:...} while ignoring:
// - line comments //...
// - block comments /* ... */
// - literal blocks {{ ... }} / {{{ ... }}} / {{{{ ... }}}}  (treated as “do not scan”)
// It’s not your final parser; it’s just enough to build the module graph reliably.

export function scanImports(source: string): string[] {
  const out: string[] = [];

  let i = 0;
  const n = source.length;

  const isWs = (c: string) => c === " " || c === "\t" || c === "\r" || c === "\n";

  const startsWith = (s: string) => source.startsWith(s, i);

  while (i < n) {
    // line comment
    if (startsWith("//")) {
      i += 2;
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (startsWith("/*")) {
      i += 2;
      while (i < n && !source.startsWith("*/", i)) i++;
      i += (i < n ? 2 : 0);
      continue;
    }

    // literal blocks: {{...}} or {{{...}}} or {{{{...}}}}
    if (startsWith("{{{{")) {
      i += 4;
      while (i < n && !source.startsWith("}}}}", i)) i++;
      i += (i < n ? 4 : 0);
      continue;
    }
    if (startsWith("{{{")) {
      i += 3;
      while (i < n && !source.startsWith("}}}", i)) i++;
      i += (i < n ? 3 : 0);
      continue;
    }
    if (startsWith("{{")) {
      i += 2;
      while (i < n && !source.startsWith("}}", i)) i++;
      i += (i < n ? 2 : 0);
      continue;
    }

    // ordinary command: { ... }
    if (source[i] === "{") {
      const start = i;
      i++; // consume '{'

      // read command name up to ':' or '}' or whitespace
      while (i < n && isWs(source[i])) i++;

      const nameStart = i;
      while (i < n) {
        const c = source[i];
        if (c === ":" || c === "}" || isWs(c) || c === ",") break;
        i++;
      }
      const cmdName = source.slice(nameStart, i).trim();

      // if "{import:...}" then read until matching '}' (no nesting for this scan)
      if (cmdName === "import") {
        while (i < n && isWs(source[i])) i++;
        if (i < n && source[i] === ":") {
          i++; // consume ':'
          // read import text until '}'
          const argStart = i;
          while (i < n && source[i] !== "}") i++;
          const rawPath = source.slice(argStart, i).trim();
          if (rawPath.length > 0) out.push(rawPath);
        }
      }

      // advance to end of this command block (first '}')
      while (i < n && source[i] !== "}") i++;
      if (i < n && source[i] === "}") i++;

      // prevent infinite loop if malformed
      if (i <= start) i = start + 1;
      continue;
    }

    i++;
  }

  return out;
}
