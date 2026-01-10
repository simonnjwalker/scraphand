import { CommandRegistry } from "../registry";
import { parseConfigPayload } from "../../config/parse";
import { ConfigBuilder } from "../../config/builder";

/**
 * Register the reserved word: {config:...}
 *
 * The caller owns the ConfigBuilder so it can merge defaults + overrides
 * across multiple files.
 */
export function registerConfigPlugin(reg: CommandRegistry, builder: ConfigBuilder) {
  reg.registerCommand("config", (call, ctx) => {
    const payload = call.arg ?? "";
    try {
      const assigns = parseConfigPayload(payload);
      builder.applyMany(assigns);
    } catch (e: any) {
      ctx.diagnostics.error(
        `Invalid config directive: ${String(e?.message ?? e)}`,
        ctx.currentDoc.fileId,
        call.span,
        "E_CONFIG_PARSE"
      );
    }

    return { consumed: true };
  });
}
