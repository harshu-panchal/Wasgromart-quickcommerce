/**
 * Phase 1: Build Cloudinary → Local File Mapping
 * 
 * Reads the downloaded Cloudinary index.json, filters to only Wasgromart folders,
 * verifies local files exist, and outputs cloudinary-map.json.
 * 
 * Usage: npx ts-node src/scripts/buildCloudinaryMap.ts
 */

import fs from "fs";
import path from "path";

// ─── Configuration ───────────────────────────────────────────────────────────

// Path to the downloaded Cloudinary images folder
const CLOUDINARY_DIR = path.resolve(
  __dirname,
  "../../../afrontend/public/assets/cloudinary"
);
const INDEX_JSON = path.join(CLOUDINARY_DIR, "index.json");
const OUTPUT_FILE = path.resolve(__dirname, "../../cloudinary-map.json");

// Server base URL for uploaded files
const SERVER_BASE_URL = "https://api.wasgromart.com/uploads";

// Wasgromart-specific folders (everything else is another project)
const WASGROMART_FOLDERS = new Set([
  "banners",
  "categories",
  "subcategories",
  "sub-subcategories",
  "products",
  "delivery",
  "sellers",
  "seller_documents",
  "settings",
  "app-settings",
  "media",
  "popups",
  "promo-strips",
  "range-cards",
  "experience-banners",
  "returns",
  "default",
  "docs",
]);

// Folders to EXCLUDE (other projects)
const EXCLUDED_FOLDERS = new Set([
  "geeta stores",
  "geetastores",
  "speedoo",
  "kosil",
  "laxmart",
  "digital-aela",
  "carwash",
  "zetomart",
  "golden_fisheries",
  "dhakadsnazzy",
  "speeup",
  "appzeto_products",
  "plusway_products",
  "plusway_spare_parts",
  "pos-settings",
  "samples",
]);

// ─── Types ───────────────────────────────────────────────────────────────────

interface CloudinaryAsset {
  public_id: string;
  resource_type: string;
  type: string;
  format: string;
  version: number;
  created_at: string;
  bytes: number;
  width?: number;
  height?: number;
  url: string;
  secure_url: string;
  local_path: string;
  delivery_url: string;
}

interface MappingEntry {
  cloudinaryUrl: string;
  cloudinaryUrlHttp: string;
  publicId: string;
  format: string;
  localFilePath: string;       // absolute path to local file
  serverFolder: string;        // e.g., "banners"
  serverKey: string;           // e.g., "banners/abc123.jpg"
  serverUrl: string;           // e.g., "https://api.wasgromart.com/uploads/banners/abc123.jpg"
  fileExists: boolean;
  bytes: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTopLevelFolder(publicId: string): string {
  const parts = publicId.split("/");
  return parts[0].toLowerCase();
}

function isWasgromartAsset(publicId: string): boolean {
  const topFolder = getTopLevelFolder(publicId);
  
  // Exclude known other-project folders
  if (EXCLUDED_FOLDERS.has(topFolder)) return false;
  
  // Include known Wasgromart folders
  if (WASGROMART_FOLDERS.has(topFolder)) return true;
  
  // Root-level files (no folder) — include as misc
  if (!publicId.includes("/")) return true;
  
  // Unknown folder — exclude to be safe
  return false;
}

function buildServerKey(publicId: string, format: string): string {
  // The public_id is already the folder/filename structure
  // e.g., "banners/abc123" → "banners/abc123.jpg"
  return `${publicId}.${format}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Phase 1: Building Cloudinary → Local File Mapping    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  // 1. Check index.json exists
  if (!fs.existsSync(INDEX_JSON)) {
    console.error(`❌ index.json not found at: ${INDEX_JSON}`);
    console.error("   Make sure the Cloudinary images are downloaded.");
    process.exit(1);
  }

  console.log(`📂 Reading index.json from: ${INDEX_JSON}`);
  const rawBuffer = fs.readFileSync(INDEX_JSON);
  let raw: string;
  if (rawBuffer[0] === 0xFF && rawBuffer[1] === 0xFE) {
    raw = rawBuffer.toString("utf16le");
  } else if (rawBuffer[0] === 0xFE && rawBuffer[1] === 0xFF) {
    raw = rawBuffer.swap16().toString("utf16le");
  } else {
    raw = rawBuffer.toString("utf8");
  }
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }
  const allAssets: CloudinaryAsset[] = JSON.parse(raw);
  console.log(`   Total assets in Cloudinary: ${allAssets.length}`);
  console.log();

  // 2. Filter to Wasgromart-only assets
  const wasgromartAssets = allAssets.filter((a) =>
    isWasgromartAsset(a.public_id)
  );
  console.log(`🎯 Wasgromart assets: ${wasgromartAssets.length}`);
  console.log(
    `   Excluded (other projects): ${allAssets.length - wasgromartAssets.length}`
  );
  console.log();

  // 3. Build mapping and verify local files
  const mapping: Record<string, MappingEntry> = {};
  let found = 0;
  let missing = 0;
  const missingFiles: string[] = [];
  const folderCounts: Record<string, number> = {};

  for (const asset of wasgromartAssets) {
    const serverKey = buildServerKey(asset.public_id, asset.format);
    const serverUrl = `${SERVER_BASE_URL}/${serverKey}`;
    const topFolder = getTopLevelFolder(asset.public_id);

    // Build local file path from the local_path in meta or construct it
    const localRelPath = asset.local_path || `assets/cloudinary/${asset.public_id}.${asset.format}`;
    // The local_path starts with "assets/cloudinary/..." — we need to resolve from the frontend/public dir
    const localFilePath = path.resolve(
      CLOUDINARY_DIR,
      "..", "..", // go up from assets/cloudinary to public
      localRelPath
    );
    
    const fileExists = fs.existsSync(localFilePath);

    if (fileExists) {
      found++;
    } else {
      missing++;
      missingFiles.push(`${asset.public_id}.${asset.format}`);
    }

    // Count by folder
    folderCounts[topFolder] = (folderCounts[topFolder] || 0) + 1;

    // Map both http and https URLs
    const entry: MappingEntry = {
      cloudinaryUrl: asset.secure_url,
      cloudinaryUrlHttp: asset.url,
      publicId: asset.public_id,
      format: asset.format,
      localFilePath,
      serverFolder: topFolder,
      serverKey,
      serverUrl,
      fileExists,
      bytes: asset.bytes,
    };

    // Index by secure_url
    mapping[asset.secure_url] = entry;
    // Also index by http URL
    if (asset.url && asset.url !== asset.secure_url) {
      mapping[asset.url] = entry;
    }
    // Also index by delivery_url if different
    if (
      asset.delivery_url &&
      asset.delivery_url !== asset.secure_url &&
      asset.delivery_url !== asset.url
    ) {
      mapping[asset.delivery_url] = entry;
    }
  }

  // 4. Print summary
  console.log("📊 Mapping Summary:");
  console.log(`   ✅ Files found locally: ${found}`);
  console.log(`   ❌ Files missing locally: ${missing}`);
  console.log();

  console.log("📁 Assets by folder:");
  const sortedFolders = Object.entries(folderCounts).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [folder, count] of sortedFolders) {
    console.log(`   ${folder.padEnd(25)} ${count} files`);
  }
  console.log();

  // Calculate total size
  const totalBytes = Object.values(mapping).reduce(
    (sum, e) => sum + (e.fileExists ? e.bytes : 0),
    0
  );
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
  console.log(`📦 Total upload size: ~${totalMB} MB`);
  console.log();

  if (missingFiles.length > 0 && missingFiles.length <= 20) {
    console.log("⚠️  Missing files:");
    for (const f of missingFiles) {
      console.log(`   - ${f}`);
    }
    console.log();
  } else if (missingFiles.length > 20) {
    console.log(`⚠️  ${missingFiles.length} files missing locally (first 10):`);
    for (const f of missingFiles.slice(0, 10)) {
      console.log(`   - ${f}`);
    }
    console.log(`   ... and ${missingFiles.length - 10} more`);
    console.log();
  }

  // 5. Save mapping
  // Only save entries that have local files
  const validMapping: Record<string, MappingEntry> = {};
  for (const [url, entry] of Object.entries(mapping)) {
    if (entry.fileExists) {
      validMapping[url] = entry;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validMapping, null, 2));
  console.log(`💾 Saved mapping to: ${OUTPUT_FILE}`);
  console.log(`   Total URL entries: ${Object.keys(validMapping).length}`);
  console.log(`   (covers http + https + delivery URL variants)`);
  console.log();
  console.log("✅ Phase 1 complete! Next: run uploadToServer.ts");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
