import { DocumentNode } from "../../core/ast";
import { ExecuteContext } from "./context";
import { CommandRegistry, AstNode, AstCommandNode, CommandCall } from "./registry";
import { DocumentIR, Block } from "./types";

function splitRawContent(rawContent: string): { name: string; arg: string | null } {
  const s = (rawContent ?? "").trim();
  if (!s) return { name: "", arg: null };
  const i = s.indexOf(":");
  if (i === -1) return { name: s, arg: null };
  const name = s.slice(0, i).trim();
  const arg = s.slice(i + 1).trim();
  return { name, arg: arg.length ? arg : null };
}

export interface DispatchOptions {
  // If true, unknown commands become diagnostics errors
  errorOnUnknownCommands?: boolean;
  // If true, preserve unknown commands as raw text blocks instead of dropping them
  preserveUnknownAsRaw?: boolean;
}

export async function dispatchDocument(
  ast: DocumentNode,
  registry: CommandRegistry,
  ctx: ExecuteContext,
  opts: DispatchOptions = {}
): Promise<DocumentIR> {
  const blocks: Block[] = [];
  const errorUnknown = opts.errorOnUnknownCommands ?? true;
  const preserveUnknown = opts.preserveUnknownAsRaw ?? true;

  for (const node of ast.children as any as AstNode[]) {
    if (node.type === "Text") {
      // Simplest IR: each text node becomes a paragraph
      // (Later: merge adjacent text nodes into a single paragraph)
      const text = (node as any).value ?? "";
      if (text.trim().length) {
        blocks.push({ kind: "paragraph", inlines: [{ kind: "text", text }] });
      }
      continue;
    }

    if (node.type === "LiteralBlock") {
      // MVP: literal blocks become code blocks
      const text = (node as any).content ?? "";
      blocks.push({ kind: "codeBlock", text });
      continue;
    }

    if (node.type === "Command") {
      const cmdNode = node as AstCommandNode;
      const { name, arg } = splitRawContent(cmdNode.rawContent);

      const call: CommandCall = {
        name,
        arg,
        rawContent: cmdNode.rawContent,
        span: { start: cmdNode.range.start, end: cmdNode.range.end },
        node: cmdNode,
      };

      const handler = registry.getHandler(name);

      if (!handler) {
        if (errorUnknown) {
          ctx.diagnostics.error(
            `Unknown command "${name}"`,
            ctx.currentDoc.fileId,
            call.span,
            "E_UNKNOWN_COMMAND"
          );
        }
        if (preserveUnknown) {
          blocks.push({ kind: "raw", text: `{${cmdNode.rawContent}}` });
        }
        continue;
      }

      const result = await handler(call, ctx);

      if (result?.blocks?.length) blocks.push(...result.blocks);
      // (Later: support inline aggregation)
      continue;
    }
  }

  return { blocks };
}
