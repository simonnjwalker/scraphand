import { Diagnostics } from "../diagnostics";
import { ProjectGraph, SymbolTable, DocumentInfo } from "../types";

export interface Asset {
  id: string;
  mime: string;
  path?: string;
  bytes?: Uint8Array;
  meta?: Record<string, unknown>;
}

export class AssetStore {
  private assets = new Map<string, Asset>();

  put(asset: Asset) {
    this.assets.set(asset.id, asset);
  }

  get(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  all(): Asset[] {
    return [...this.assets.values()];
  }
}

export interface ExecuteContext {
  graph: ProjectGraph;
  symbols: SymbolTable;
  diagnostics: Diagnostics;
  assets: AssetStore;

  // current document while executing (useful for diagnostics)
  currentDoc: DocumentInfo;
}
