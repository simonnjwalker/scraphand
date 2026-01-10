import { CommandRegistry } from "../registry";

export function registerHtmlPlugin(reg: CommandRegistry) {
  reg.registerCommand("h1", (call) => ({
    blocks: [
      {
        kind: "heading",
        level: 1,
        inlines: [{ kind: "text", text: call.arg ?? "" }],
      },
    ],
  }));

  // You can add h2..h6 similarly later
}
