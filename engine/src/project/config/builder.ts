import { ConfigAssignment, ConfigValue, ScraphandConfig } from "./types";

function isPluralKey(key: string): boolean {
  // Simple convention: plural ends with "s"
  // works for: plugins, outputs, paths
  return key.endsWith("s");
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function ensureObjectAt(root: any, path: string[]): any {
  let cur = root;
  for (let i = 0; i < path.length; i++) {
    const k = path[i];
    const isLast = i === path.length - 1;
    if (isLast) return { parent: cur, key: k };
    if (cur[k] == null || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k];
  }
  return { parent: root, key: path[path.length - 1] };
}

export class ConfigBuilder {
  private cfg: ScraphandConfig = {};

  get(): ScraphandConfig {
    return this.cfg;
  }

  apply(assign: ConfigAssignment) {
    const { parent, key } = ensureObjectAt(this.cfg, assign.path);

    const plural = isPluralKey(key);

    switch (assign.op) {
      case "=": {
        parent[key] = assign.value as ConfigValue;
        return;
      }

      case "+=": {
        if (!plural) {
          // Non-plural append: treat as error in your diagnostics layer if you want.
          // For now, we coerce to array to be forgiving.
          if (!Array.isArray(parent[key])) parent[key] = parent[key] == null ? [] : [parent[key]];
          (parent[key] as any[]).push(assign.value);
          return;
        }

        if (!Array.isArray(parent[key])) parent[key] = [];
        (parent[key] as any[]).push(assign.value);
        return;
      }

      case "-=": {
        if (!Array.isArray(parent[key])) return;
        parent[key] = (parent[key] as any[]).filter((x) => !deepEqual(x, assign.value));
        return;
      }

      case "!=": {
        // reset
        if (plural) {
          parent[key] = [];
          if (assign.value !== undefined) {
            (parent[key] as any[]).push(assign.value);
          }
        } else {
          // singleton reset: delete unless value provided
          if (assign.value === undefined) {
            delete parent[key];
          } else {
            parent[key] = assign.value;
          }
        }
        return;
      }
    }
  }

  applyMany(assignments: ConfigAssignment[]) {
    for (const a of assignments) this.apply(a);
  }
}
