/**
 * Copy root server.js into dist/ so Hostinger can use Entry file: dist/server.js
 * server.js auto-detects whether it runs from project root or from dist/.
 */
import fs from "fs";
import path from "path";

const src = path.resolve("server.js");
const dest = path.resolve("dist", "server.js");

if (!fs.existsSync(path.resolve("dist", "index.html"))) {
  console.error("postbuild: dist/index.html missing — run vite build first");
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log("postbuild: copied server.js → dist/server.js");
