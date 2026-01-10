import { RuntimeFS } from "./fs";
import * as path from "node:path";

export type ImportBase = "workspaceRoot" | "fileDir";

export interface ImportResolverOptions {
  base: ImportBase;
  workspaceRoot?: string; // required if base=workspaceRoot
  extensions?: string[];  // e.g. [".sh1"]
}

export class ImportResolver {
  constructor(private fs: RuntimeFS, private opts: ImportResolverOptions) {}

  resolveImport(fromFile: string, importPath: string): string | null {
    const p = importPath.trim();
    if (!p) return null;

    // Absolute
    if (path.isAbsolute(p)) return this.fs.normalize(p);

    let baseDir: string;
    if (this.opts.base === "workspaceRoot") {
      if (!this.opts.workspaceRoot) return null;
      baseDir = this.opts.workspaceRoot;
    } else {
      baseDir = this.fs.dirname(fromFile);
    }

    const resolved = this.fs.normalize(this.fs.resolve(baseDir, p));
    return resolved;
  }

  /**
   * Optionally try with extensions if file has no extension.
   */
  async resolveImportExisting(fromFile: string, importPath: string): Promise<string | null> {
    const raw = this.resolveImport(fromFile, importPath);
    if (!raw) return null;

    if (await this.fs.exists(raw)) return raw;

    const exts = this.opts.extensions ?? [];
    const hasDot = /\.[A-Za-z0-9]+$/.test(raw);
    if (!hasDot) {
      for (const ext of exts) {
        const candidate = raw + ext;
        if (await this.fs.exists(candidate)) return candidate;
      }
    }

    return null;
  }
}
