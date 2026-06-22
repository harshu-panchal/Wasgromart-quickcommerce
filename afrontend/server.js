/**
 * Production static file server for the Vite/React SPA on Hostinger Node.js.
 *
 * Hostinger hPanel settings (frontend app):
 *   Entry file:  server.js          ← NOT dist/server.js
 *   Build:       npm run build
 *   Start:       npm start
 *
 * dist/ is Vite output only (index.html + assets). This file is not compiled into dist/.
 */
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const indexHtml = path.join(distDir, "index.html");

if (!fs.existsSync(indexHtml)) {
  console.error(
    `[startup] Missing ${indexHtml}. Run "npm run build" before "npm start".`
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Hostinger runs behind a reverse proxy
app.set("trust proxy", 1);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "wasgro-frontend" });
});

// Static assets from Vite build
app.use(
  express.static(distDir, {
    index: false,
    maxAge: "7d",
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// SPA fallback — React Router client-side routes (e.g. /seller/dashboard)
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  res.sendFile(indexHtml, (err) => {
    if (err) next(err);
  });
});

app.use((err, _req, res, _next) => {
  console.error("[server]", err);
  res.status(500).send("Internal server error");
});

app.listen(PORT, () => {
  console.log(`Wasgro frontend serving ${distDir} on port ${PORT}`);
});
