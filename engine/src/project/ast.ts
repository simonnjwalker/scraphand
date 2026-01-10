import { CommandInstance, SourceSpan } from "./types";

/**
 * Hook your real parser here.
 * - Return any AST object
 */
export type ParseFn = (text: string, fileId: string) => unknown;

/**
 * Extract {command:arg} instances from your AST.
 * If you don’t have an easy way yet, return null and we’ll use fallback scanning.
 */
export type ExtractCommandsFn = (ast: unknown) => CommandInstance[] | null;

// Minimal fallback: scans `{name:arg}` on raw text (ignores your advanced escaping rules).
const COMMAND_BLOCK = /\{([A-Za-z_][A-Za-z0-9_-]*)(?::([^{}]*))?\}/g;

export function fallbackExtractCommandsFromText(text: string): CommandInstance[] {
  const out: CommandInstance[] = [];
  let m: RegExpExecArray | null;
  COMMAND_BLOCK.lastIndex = 0;

  while ((m = COMMAND_BLOCK.exec(text)) !== null) {
    const name = m[1];
    const arg = (m[2] ?? null)?.trim?.() ?? null;

    const span: SourceSpan = {
      start: { offset: m.index + 1 }, // points at command name start
      end: { offset: m.index + 1 + name.length },
    };

    out.push({ name, arg, span });
  }

  return out;
}
