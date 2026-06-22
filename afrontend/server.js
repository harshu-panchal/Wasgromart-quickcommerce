/**
 * Production static file server for the Vite/React SPA on Hostinger Node.js.
 *
 * Hostinger's "Entry file" must point to this file (server.js), NOT dist/server.js.
 * dist/ contains only the Vite build output (index.html + assets).
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const distDir = path.join(__dirname, "dist");

app.use(
  express.static(distDir, {
    index: "index.html",
    maxAge: "7d",
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// React Router — serve index.html for client-side routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Wasgro frontend serving dist/ on port ${PORT}`);
});
