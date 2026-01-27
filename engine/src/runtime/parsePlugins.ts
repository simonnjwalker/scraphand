import type { ConfigLike, OutputSpec, ProjectGraphLike } from "sh1-runtime";

function splitTopLevelComma(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;

  for (const ch of s) {
    if (ch === "[") depth++;
    if (ch === "]" && depth > 0) depth--;

    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }

  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseOutputObject(text: string): OutputSpec | null {
  // Accept either "[type=html,path=out/x.html]" or "type=html,path=out/x.html"
  const m = text.match(/^\s*\[\s*(.*?)\s*\]\s*$/);
  const inside = m ? m[1] : text;

  const parts = inside.split(",").map(s => s.trim()).filter(Boolean);
  const obj: Record<string, string> = {};

  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    obj[k] = v;
  }

  if (!obj.type || !obj.path) return null;

  return {
    type: String(obj.type),
    path: String(obj.path),
  };
}

export function parsePlugins(project: ProjectGraphLike): ConfigLike {
  const cfg: ConfigLike = { outputs: [], plugins: [] };

  for (const doc of project.documents.values()) {
    const children: any[] = doc.ast?.children ?? [];
    for (const n of children) {
      if (n?.type !== "Command" || typeof n.rawContent !== "string") continue;

      const raw = n.rawContent.trim();
      if (!raw.startsWith("config:")) continue;

      const arg = raw.slice("config:".length);
      const tokens = splitTopLevelComma(arg);

      for (const t of tokens) {
        // plugins+=sh1-docgen
        const pm = t.match(/^plugins\+\=\s*(.+)$/);
        if (pm) {
          const name = pm[1].trim();
          if (name) cfg.plugins!.push(name);
          continue;
        }

        // outputs+=[type=html,path=...]
        const om = t.match(/^outputs\+\=\s*(.+)$/);
        if (om) {
          const spec = parseOutputObject(om[1]);
          if (spec) cfg.outputs!.push(spec);
          continue;
        }
      }
    }
  }

  // Normalise empties
  if (!cfg.outputs?.length) delete cfg.outputs;
  if (!cfg.plugins?.length) delete cfg.plugins;

  return cfg;
}


