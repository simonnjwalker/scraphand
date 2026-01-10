import { Diagnostics } from "./diagnostics";
import { DocumentInfo, SymbolInfo, SymbolTable } from "./types";

export interface BuildSymbolsOptions {
  enforceUnique?: boolean; // if true, error on duplicates
}

export function buildSymbolTable(
  diag: Diagnostics,
  docs: Iterable<DocumentInfo>,
  opts: BuildSymbolsOptions = {}
): SymbolTable {
  const defs = new Map<string, SymbolInfo[]>();

  for (const doc of docs) {
    for (const cmd of doc.commands) {
      if (cmd.name !== "define") continue;
      const name = (cmd.arg ?? "").trim();
      if (!name) {
        diag.error(`Empty define name`, doc.fileId, cmd.span, "E_DEFINE_EMPTY");
        continue;
      }

      const info: SymbolInfo = { name, definedIn: doc.fileId, span: cmd.span };
      const arr = defs.get(name) ?? [];
      arr.push(info);
      defs.set(name, arr);

      if (opts.enforceUnique && arr.length > 1) {
        diag.error(
          `Duplicate definition for "${name}"`,
          doc.fileId,
          cmd.span,
          "E_DEFINE_DUPLICATE"
        );
      }
    }
  }

  return { defs };
}
