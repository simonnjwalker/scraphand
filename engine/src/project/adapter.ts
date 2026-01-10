import { CommandInstance } from "./types";
import { DocumentNode, AstNode } from "../core/ast";

/**
 * Extract {command:arg} instances from your Scraphand AST
 */

function splitRawContent(rawContent: string): { name: string; arg: string | null } {
  const s = (rawContent ?? "").trim();
  if (!s) return { name: "", arg: null };

  const i = s.indexOf(":");
  if (i === -1) return { name: s, arg: null };

  const name = s.slice(0, i).trim();
  const arg = s.slice(i + 1).trim();
  return { name, arg: arg.length ? arg : null };
}

export function extractCommandsFromScraphandAst(ast: unknown): CommandInstance[] {
  const doc = ast as DocumentNode;
  if (!doc || doc.type !== "Document") return [];

  const commands: CommandInstance[] = [];

  for (const node of (doc.children as any[])) {
    if (node.type !== "Command") continue;

    const { name, arg } = splitRawContent(node.rawContent);

    if (!name) continue;

    commands.push({
      name,
      arg,
      // IMPORTANT: our runtime wants SourceSpan with start/end objects.
      // Your parser range already has offset/line/column.
      span: { start: node.range.start, end: node.range.end },
    });
  }

  return commands;
}