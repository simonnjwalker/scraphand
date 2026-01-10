import * as fs from "node:fs";
import * as path from "node:path";
import { buildModuleGraph } from "../project/grapher";

function usage(): never {
  console.error("Usage:");
  console.error("  node dist/cli.js graph <entry.sh1>");
  console.error("  node dist/cli.js ast <entry.sh1> <outDir>");
  process.exit(2);
}

const cmd = process.argv[2];
const entry = process.argv[3];

if (!cmd || !entry) usage();

if (cmd === "graph") {
  const g = buildModuleGraph(entry, { enableAutoLink: true });
  console.log("Topological order:");
  for (const f of g.order) console.log("  " + f);

  console.log("\nEdges:");
  for (const [from, tos] of g.edges.entries()) {
    for (const to of tos) console.log(`  ${from} -> ${to}`);
  }
} else if (cmd === "ast") {
  const outDir = process.argv[4];
  if (!outDir) usage();

  const g = buildModuleGraph(entry, { enableAutoLink: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const f of g.order) {
    const ast = g.nodes.get(f)!;
    const out = path.join(outDir, path.basename(f) + ".ast.json");
    fs.writeFileSync(out, JSON.stringify(ast, null, 2), "utf8");
    console.log("Wrote " + out);
  }
} else {
  usage();
}
