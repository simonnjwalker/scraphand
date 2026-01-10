import { CommandRegistry } from "../registry";

export function registerCorePlugin(reg: CommandRegistry) {
  // import already handled by project graph; consume at execution time
  reg.registerCommand("import", () => ({ consumed: true }));

  // define already handled by symbol table; consume at execution time
  reg.registerCommand("define", () => ({ consumed: true }));

  // Add a few suggested core commands (optional stubs)
  reg.registerCommand("p", (call) => ({
    blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: call.arg ?? "" }] }],
  }));
}
