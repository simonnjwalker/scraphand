import * as vscode from "vscode";

export type CommandOrigin = "builtin" | "library";

export interface CommandInfo {
  name: string;
  origin: CommandOrigin;
  documentation: string;
  definedAt?: vscode.Location;
  argsHint?: string; // for completions
}

export const BUILTINS: Record<string, Omit<CommandInfo, "name">> = {
  import: {
    origin: "builtin",
    documentation:
      "Imports another Scraphand file.\n\nSyntax: `{import:path}`\nExample: `{import:lib/html.sh1}`",
    argsHint: "path",
  },
  define: {
    origin: "builtin",
    documentation:
      "Defines a command.\n\nRecommended syntax: `{define:name,doc=\"...\",args=\"...\"}`",
    argsHint: "name,doc=...,args=...",
  },
  config: {
    origin: "builtin",
    documentation:
      "Applies configuration directives.\n\nSyntax: `{config:key=value,key+=value}`\nExample: `{config:bibliography.style=apa7}`",
    argsHint: "k=v,k+=v,k-=v,k!=v",
  },
};
