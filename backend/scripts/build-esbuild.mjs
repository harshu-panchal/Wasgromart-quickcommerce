/**
 * Production build for shared hosting (Hostinger).
 *
 * `tsc` type-checks the whole project and often exceeds the ~384–512 MB Node
 * heap limit on shared hosts. esbuild only transpiles (no type-check) and uses
 * far less RAM. Run `npm run typecheck` locally or in CI for types.
 */
import esbuild from "esbuild";
import fs from "fs";
import path from "path";

const SRC = "src";
const OUT = "dist";
const SKIP_DIRS = new Set(["scripts"]);

/** Collect .ts entry files under src/, skipping one-off CLI scripts. */
function collectTsFiles(dir, rel = "") {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      entries.push(...collectTsFiles(abs, relPath));
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
      entries.push(abs);
    }
  }
  return entries;
}

const entryPoints = collectTsFiles(SRC);
if (entryPoints.length === 0) {
  console.error("No TypeScript files found under src/");
  process.exit(1);
}

console.log(`esbuild: transpiling ${entryPoints.length} files → ${OUT}/`);

await esbuild.build({
  entryPoints,
  outdir: OUT,
  outbase: SRC,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  logLevel: "info",
  // Leave node_modules imports as runtime require() — do not bundle deps.
  packages: "external",
});

console.log("esbuild: done");
