// vite.config.ts
import { defineConfig } from "file:///C:/Users/AnkitAhirwar/OneDrive/Desktop/SpeeUp/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/AnkitAhirwar/OneDrive/Desktop/SpeeUp/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";

// vite-plugin-serve-assets.ts
import { readFileSync, existsSync } from "fs";
import { join, resolve, extname } from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/AnkitAhirwar/OneDrive/Desktop/SpeeUp/frontend/vite-plugin-serve-assets.ts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname2 = resolve(__filename, "..");
function serveAssetsPlugin() {
  return {
    name: "serve-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        if (url?.startsWith("/assets/")) {
          const assetPath = url.replace("/assets/", "");
          const assetsDir = resolve(__dirname2, "assets");
          const fullPath = join(assetsDir, assetPath);
          if (!fullPath.startsWith(assetsDir)) {
            return next();
          }
          if (existsSync(fullPath)) {
            const ext = extname(fullPath).toLowerCase();
            const mimeTypes = {
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".png": "image/png",
              ".gif": "image/gif",
              ".webp": "image/webp",
              ".svg": "image/svg+xml",
              ".mp4": "video/mp4",
              ".webm": "video/webm"
            };
            const contentType = mimeTypes[ext] || "application/octet-stream";
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            const file = readFileSync(fullPath);
            res.end(file);
            return;
          }
        }
        next();
      });
    }
  };
}

// vite.config.ts
var __vite_injected_original_dirname = "C:\\Users\\AnkitAhirwar\\OneDrive\\Desktop\\SpeeUp\\frontend";
var vite_config_default = defineConfig({
  plugins: [react(), serveAssetsPlugin()],
  assetsInclude: ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.webp"],
  server: {
    fs: {
      strict: false
    },
    middlewareMode: false
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@assets": path.resolve(__vite_injected_original_dirname, "./assets")
    }
  },
  optimizeDeps: {
    exclude: []
  }
});
export {
  vite_config_default as default
};
