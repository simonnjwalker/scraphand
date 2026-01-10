import { ExecuteContext } from "./context";
import { Block, Inline } from "./types";
import { SourceSpan } from "../types";

// Your AST node shapes (minimal)
export type AstTextNode = { type: "Text"; value: string; range: { start: any; end: any } };
export type AstCommandNode = { type: "Command"; rawContent: string; range: { start: any; end: any } };
export type AstLiteralBlockNode = { type: "LiteralBlock"; content: string; delimiterLength: number; range: { start: any; end: any } };
export type AstNode = AstTextNode | AstCommandNode | AstLiteralBlockNode;

// Parsed command info passed to handlers
export interface CommandCall {
  name: string;
  arg: string | null;
  rawContent: string;
  span?: SourceSpan;
  node: AstCommandNode;
}

export interface HandlerResult {
  // blocks to emit into the IR
  blocks?: Block[];
  // or inline to be merged into a paragraph builder (optional, future)
  inlines?: Inline[];
  // if handler consumes without emitting anything
  consumed?: boolean;
}

export type CommandHandler = (call: CommandCall, ctx: ExecuteContext) => HandlerResult | Promise<HandlerResult>;

export class CommandRegistry {
  private handlers = new Map<string, CommandHandler>();

  registerCommand(name: string, handler: CommandHandler) {
    this.handlers.set(name, handler);
  }

  getHandler(name: string): CommandHandler | undefined {
    return this.handlers.get(name);
  }

  listCommands(): string[] {
    return [...this.handlers.keys()].sort();
  }
}
