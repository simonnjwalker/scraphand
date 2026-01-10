// engine/src/project/fs.ts
import { promises as fsp } from "node:fs";
import * as path from "node:path";

export interface RuntimeFS {
  normalize(p: string): string;
  resolve(...parts: string[]): string;
  dirname(p: string): string;

  exists(p: string): Promise<boolean>;
  readText(p: string): Promise<string>;

  // NEW: required for implicit companion loading
  readDir(dirPath: string): Promise<string[]>;
}

export class NodeFS implements RuntimeFS {
  normalize(p: string): string {
    return path.normalize(p);
  }

  resolve(...parts: string[]): string {
    return path.resolve(...parts);
  }

  dirname(p: string): string {
    return path.dirname(p);
  }

  async exists(p: string): Promise<boolean> {
    try {
      await fsp.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async readText(p: string): Promise<string> {
    return await fsp.readFile(p, "utf8");
  }

  async readDir(dirPath: string): Promise<string[]> {
    return await fsp.readdir(dirPath);
  }
}
