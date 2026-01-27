// engine/src/runtime/pluginCatalog.ts

export interface PluginCatalogEntry {
  name: string;
  provides?: string[];
  consumes?: string[];
}

/**
 * Minimal known-plugin catalogue.
 * This is what enables auto-including dependencies by artefact type.
 *
 * Later you can generate this dynamically, but this is perfect for MVP.
 */
export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  {
    name: "sh1-docgen",
    provides: ["docgen/ir"],
    consumes: [],
  },
  {
    name: "sh1-cite",
    provides: ["cite/ir", "cite/csl-json", "cite/formatted"],
    consumes: ["docgen/ir"],
  },
  {
    name: "sh1-latex",
    provides: ["latex/png", "latex/map"],
    consumes: ["docgen/ir"],
  },
  {
    name: "sh1-html",
    provides: ["file/html"],
    consumes: ["docgen/ir"], // plus optional latex/map + cite/ir, but keep minimal
  },
  {
    name: "sh1-docx",
    provides: ["file/docx"],
    consumes: ["docgen/ir"], // plus optional cite/csl-json + latex/map
  },
];

export function findProviderPluginsFor(type: string): string[] {
  return PLUGIN_CATALOG
    .filter(p => (p.provides ?? []).includes(type))
    .map(p => p.name);
}

export function getCatalogEntry(name: string) {
  return PLUGIN_CATALOG.find(p => p.name === name);
}
