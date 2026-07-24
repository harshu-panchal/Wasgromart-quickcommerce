/**
 * Phase 1: Build Cloudinary → Local File Mapping (Plain JS version)
 * Usage: node src/scripts/buildCloudinaryMap.js
 */

const fs = require("fs");
const pathModule = require("path");

const CLOUDINARY_DIR = pathModule.resolve(
  __dirname,
  "../../../afrontend/public/assets/cloudinary"
);
const INDEX_JSON = pathModule.join(CLOUDINARY_DIR, "index.json");
const OUTPUT_FILE = pathModule.resolve(__dirname, "../../cloudinary-map.json");
const SERVER_BASE_URL = "https://api.wasgromart.com/uploads";

const WASGROMART_FOLDERS = new Set([
  "banners", "categories", "subcategories", "sub-subcategories",
  "products", "delivery", "sellers", "seller_documents",
  "settings", "app-settings", "media", "popups",
  "promo-strips", "range-cards", "experience-banners",
  "returns", "default", "docs",
]);

const EXCLUDED_FOLDERS = new Set([
  "geeta stores", "geetastores", "speedoo", "kosil", "laxmart",
  "digital-aela", "carwash", "zetomart", "golden_fisheries",
  "dhakadsnazzy", "speeup", "appzeto_products", "plusway_products",
  "plusway_spare_parts", "pos-settings", "samples",
]);

function getTopLevelFolder(publicId) {
  return publicId.split("/")[0].toLowerCase();
}

function isWasgromartAsset(publicId) {
  const topFolder = getTopLevelFolder(publicId);
  if (EXCLUDED_FOLDERS.has(topFolder)) return false;
  if (WASGROMART_FOLDERS.has(topFolder)) return true;
  if (!publicId.includes("/")) return true;
  return false;
}

function main() {
  console.log("Phase 1: Building Cloudinary -> Local File Mapping");
  console.log("==================================================\n");

  if (!fs.existsSync(INDEX_JSON)) {
    console.error("index.json not found at: " + INDEX_JSON);
    process.exit(1);
  }

  console.log("Reading index.json from: " + INDEX_JSON);
  let rawBuffer = fs.readFileSync(INDEX_JSON);
  let raw;
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
  const allAssets = JSON.parse(raw);
  console.log("Total assets in Cloudinary: " + allAssets.length + "\n");

  const wasgromartAssets = allAssets.filter((a) => isWasgromartAsset(a.public_id));
  console.log("Wasgromart assets: " + wasgromartAssets.length);
  console.log("Excluded (other projects): " + (allAssets.length - wasgromartAssets.length) + "\n");

  const mapping = {};
  let found = 0;
  let missing = 0;
  const missingFiles = [];
  const folderCounts = {};

  for (const asset of wasgromartAssets) {
    const serverKey = asset.public_id + "." + asset.format;
    const serverUrl = SERVER_BASE_URL + "/" + serverKey;
    const topFolder = getTopLevelFolder(asset.public_id);

    const localRelPath = asset.local_path || ("assets/cloudinary/" + asset.public_id + "." + asset.format);
    const localFilePath = pathModule.resolve(CLOUDINARY_DIR, "..", "..", localRelPath);

    const fileExists = fs.existsSync(localFilePath);

    if (fileExists) found++;
    else {
      missing++;
      missingFiles.push(asset.public_id + "." + asset.format);
    }

    folderCounts[topFolder] = (folderCounts[topFolder] || 0) + 1;

    const entry = {
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

    mapping[asset.secure_url] = entry;
    if (asset.url && asset.url !== asset.secure_url) {
      mapping[asset.url] = entry;
    }
    if (asset.delivery_url && asset.delivery_url !== asset.secure_url && asset.delivery_url !== asset.url) {
      mapping[asset.delivery_url] = entry;
    }
  }

  console.log("Mapping Summary:");
  console.log("  Files found locally: " + found);
  console.log("  Files missing locally: " + missing + "\n");

  console.log("Assets by folder:");
  const sortedFolders = Object.entries(folderCounts).sort((a, b) => b[1] - a[1]);
  for (const [folder, count] of sortedFolders) {
    console.log("  " + folder.padEnd(25) + " " + count + " files");
  }
  console.log();

  const totalBytes = Object.values(mapping).reduce(
    (sum, e) => sum + (e.fileExists ? e.bytes : 0), 0
  );
  console.log("Total upload size: ~" + (totalBytes / (1024 * 1024)).toFixed(1) + " MB\n");

  if (missingFiles.length > 0 && missingFiles.length <= 20) {
    console.log("Missing files:");
    for (const f of missingFiles) console.log("  - " + f);
    console.log();
  } else if (missingFiles.length > 20) {
    console.log(missingFiles.length + " files missing locally (first 10):");
    for (const f of missingFiles.slice(0, 10)) console.log("  - " + f);
    console.log("  ... and " + (missingFiles.length - 10) + " more\n");
  }

  const validMapping = {};
  for (const [url, entry] of Object.entries(mapping)) {
    if (entry.fileExists) validMapping[url] = entry;
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validMapping, null, 2));
  console.log("Saved mapping to: " + OUTPUT_FILE);
  console.log("Total URL entries: " + Object.keys(validMapping).length);
  console.log("\nPhase 1 complete! Next: run uploadToServer.ts");
}

main();
