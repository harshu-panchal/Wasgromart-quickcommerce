import dotenv from "dotenv";
import fs from "fs";
import path from "path";

let loaded = false;
let loadedFromPath: string | null = null;

export function ensureEnvLoaded(): void {
  if (loaded) return;

  const candidates = [
    // When running from backend/: `npm run dev` / `npm start`
    path.resolve(process.cwd(), ".env"),
    // When running from repo root: `node backend/dist/server.js`
    path.resolve(process.cwd(), "backend", ".env"),
    // When running compiled output from backend/dist/*
    path.resolve(__dirname, "..", "..", ".env"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    dotenv.config({ path: candidate });
    loadedFromPath = candidate;
    loaded = true;
    return;
  }

  // Fall back to dotenv's default lookup (current working directory)
  dotenv.config();
  loaded = true;
}

export function getEnvLoadedFrom(): string | null {
  return loadedFromPath;
}

