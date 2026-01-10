import { Diagnostic, FileId, SourceSpan } from "./types";

export class Diagnostics {
  private list: Diagnostic[] = [];

  add(d: Diagnostic) {
    this.list.push(d);
  }

  error(message: string, fileId?: FileId, span?: SourceSpan, code?: string) {
    this.add({ severity: "error", message, fileId, span, code });
  }

  warn(message: string, fileId?: FileId, span?: SourceSpan, code?: string) {
    this.add({ severity: "warning", message, fileId, span, code });
  }

  info(message: string, fileId?: FileId, span?: SourceSpan, code?: string) {
    this.add({ severity: "info", message, fileId, span, code });
  }

  all(): Diagnostic[] {
    return [...this.list];
  }

  hasErrors(): boolean {
    return this.list.some((d) => d.severity === "error");
  }
}
