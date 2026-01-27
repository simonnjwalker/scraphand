// engine/src/runtime/planPlugins.ts
import type { Plugin } from "sh1-runtime";
import { findProviderPluginsFor } from "./pluginCatalog";

export interface PlannedPluginsResult {
  ordered: Plugin[];
  autoAdded: string[];
  warnings: string[];
}

/**
 * Auto-add plugins that provide artefacts required by consumes,
 * then topologically sort based on provides/consumes.
 */
export async function planPlugins(
  initialNames: string[],
  loadByName: (name: string) => Promise<{ plugin: Plugin | null; error?: string }>
): Promise<PlannedPluginsResult> {
  const warnings: string[] = [];
  const autoAdded: string[] = [];

  const loaded = new Map<string, Plugin>();

  async function ensureLoaded(name: string, isAuto = false) {
    if (loaded.has(name)) return;

    const r = await loadByName(name);
    if (!r.plugin) {
      warnings.push(`Plugin not loaded: ${name}${r.error ? `\n${r.error}` : ""}`);
      return;
    }
    loaded.set(name, r.plugin);
    if (isAuto) autoAdded.push(name);
  }

  // 1) load requested
  for (const n of initialNames) await ensureLoaded(n, false);

  // 2) expand deps until fixed point
  let changed = true;
  while (changed) {
    changed = false;

    for (const p of loaded.values()) {
      for (const need of p.consumes ?? []) {
        const hasProviderAlready = [...loaded.values()].some(x => (x.provides ?? []).includes(need));
        if (hasProviderAlready) continue;

        // Find provider plugin(s) from catalogue
        const providerNames = findProviderPluginsFor(need);

        if (!providerNames.length) {
          warnings.push(`No known plugin provides required artefact type "${need}" (needed by ${p.name}).`);
          continue;
        }

        // Load the first provider (you can get fancier later)
        const pick = providerNames[0];
        if (!loaded.has(pick)) {
          await ensureLoaded(pick, true);
          changed = true;
        }
      }
    }
  }

  // 3) topo-sort loaded plugins
  const ordered = topoSortPlugins([...loaded.values()], warnings);

  return { ordered, autoAdded, warnings };
}

function topoSortPlugins(plugins: Plugin[], warnings: string[]): Plugin[] {
  const provides = new Map<string, Set<string>>();
  for (const p of plugins) provides.set(p.name, new Set(p.provides ?? []));

  // edge: A -> B means A depends on B (B must run first)
  const deps = new Map<string, Set<string>>();
  for (const a of plugins) {
    const aNeeds = new Set(a.consumes ?? []);
    const aDeps = new Set<string>();

    for (const b of plugins) {
      if (a.name === b.name) continue;
      const bProvides = provides.get(b.name)!;
      const intersects = [...aNeeds].some(t => bProvides.has(t));
      if (intersects) aDeps.add(b.name);
    }
    deps.set(a.name, aDeps);
  }

  // Kahn
  const inDeg = new Map<string, number>();
  for (const p of plugins) inDeg.set(p.name, 0);
  for (const [a, ds] of deps) {
    for (const d of ds) inDeg.set(a, (inDeg.get(a) ?? 0));
    for (const d of ds) inDeg.set(d, inDeg.get(d)!);
  }
  for (const [a, ds] of deps) {
    for (const d of ds) inDeg.set(a, (inDeg.get(a) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [n, d] of inDeg) if (d === 0) queue.push(n);

  const out: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);

    for (const [a, ds] of deps) {
      if (!ds.has(n)) continue;
      ds.delete(n);
      inDeg.set(a, inDeg.get(a)! - 1);
      if (inDeg.get(a) === 0) queue.push(a);
    }
  }

  if (out.length !== plugins.length) {
    warnings.push("Plugin dependency cycle detected; falling back to input order.");
    return plugins;
  }

  const byName = new Map(plugins.map(p => [p.name, p] as const));
  return out.map(n => byName.get(n)!).filter(Boolean);
}
