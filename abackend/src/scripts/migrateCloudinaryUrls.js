/**
 * Phase 3: Migrate Cloudinary URLs in MongoDB to Local Server URLs (Plain JS)
 *
 * Usage:
 *   node src/scripts/migrateCloudinaryUrls.js          # Dry run
 *   node src/scripts/migrateCloudinaryUrls.js --live   # Update DB
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load .env
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const MAP_FILE = path.resolve(__dirname, "../../cloudinary-map.json");
const AUDIT_FILE = path.resolve(__dirname, "../../migration-audit.json");
const SERVER_BASE_URL = "https://api.wasgromart.com/uploads";
const CLOUDINARY_URL_REGEX = /https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video|raw)\/upload(?:\/[^/]+)*\/v\d+\/(.+)/;

const COLLECTIONS_TO_MIGRATE = [
  {
    collection: "products",
    simpleFields: ["mainImage"],
    arrayFields: ["galleryImages"],
    nestedArrays: [{ arrayPath: "variations", fields: ["mainImage"], arraySubFields: ["galleryImages"] }],
  },
  { collection: "categories", simpleFields: ["image"], arrayFields: [], nestedArrays: [] },
  { collection: "subcategories", simpleFields: ["image"], arrayFields: [], nestedArrays: [] },
  { collection: "banners", simpleFields: ["image"], arrayFields: [], nestedArrays: [] },
  { collection: "brands", simpleFields: ["image"], arrayFields: [], nestedArrays: [] },
  { collection: "sellers", simpleFields: ["profile", "idProof", "addressProof", "logo", "storeBanner"], arrayFields: [], nestedArrays: [] },
  { collection: "deliveries", simpleFields: ["drivingLicense", "nationalIdentityCard"], arrayFields: [], nestedArrays: [] },
  { collection: "customers", simpleFields: ["profilePhoto"], arrayFields: [], nestedArrays: [] },
  { collection: "appsettings", simpleFields: ["appLogo", "appFavicon"], arrayFields: [], nestedArrays: [] },
  { collection: "returns", simpleFields: [], arrayFields: ["images"], nestedArrays: [] },
];

function isCloudinaryUrl(url) {
  return url && typeof url === "string" && url.includes("res.cloudinary.com");
}

function transformUrl(url, mapping) {
  if (!isCloudinaryUrl(url)) return null;

  if (mapping[url]) {
    return { newUrl: mapping[url].serverUrl, matched: true };
  }

  const match = url.match(CLOUDINARY_URL_REGEX);
  if (match) {
    const pathWithExt = match[1];
    return { newUrl: SERVER_BASE_URL + "/" + pathWithExt, matched: false };
  }

  return null;
}

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("Phase 3: Migrate Cloudinary URLs in MongoDB");
  console.log("==========================================");
  if (!isLive) {
    console.log("DRY RUN MODE — no database changes will be made");
    console.log("Add --live argument to update the database\n");
  } else {
    console.log("🔴 LIVE MODE — database WILL be updated!\n");
  }

  let mapping = {};
  if (fs.existsSync(MAP_FILE)) {
    mapping = JSON.parse(fs.readFileSync(MAP_FILE, "utf-8"));
    console.log("Loaded mapping with " + Object.keys(mapping).length + " URL entries\n");
  } else {
    console.log("No mapping file found — using regex-only URL transformation\n");
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected!\n");

  const db = mongoose.connection.db;
  const auditLog = [];
  let totalUrlsFound = 0;
  let totalMapped = 0;
  let totalRegexOnly = 0;
  let totalUpdatedDocs = 0;

  for (const config of COLLECTIONS_TO_MIGRATE) {
    console.log("--- " + config.collection.toUpperCase() + " ---");

    const collection = db.collection(config.collection);
    const orConditions = [];

    for (const field of config.simpleFields) {
      orConditions.push({ [field]: { $regex: "res\\.cloudinary\\.com" } });
    }
    for (const field of config.arrayFields) {
      orConditions.push({ [field]: { $regex: "res\\.cloudinary\\.com" } });
    }
    for (const nested of config.nestedArrays) {
      for (const field of nested.fields) {
        orConditions.push({ [nested.arrayPath + "." + field]: { $regex: "res\\.cloudinary\\.com" } });
      }
      if (nested.arraySubFields) {
        for (const field of nested.arraySubFields) {
          orConditions.push({ [nested.arrayPath + "." + field]: { $regex: "res\\.cloudinary\\.com" } });
        }
      }
    }

    if (orConditions.length === 0) continue;

    const docs = await collection.find({ $or: orConditions }).toArray();
    console.log("  Found " + docs.length + " documents with Cloudinary URLs");

    if (docs.length === 0) continue;

    for (const doc of docs) {
      const updates = {};
      let docHasChanges = false;

      for (const field of config.simpleFields) {
        const url = doc[field];
        if (!url || !isCloudinaryUrl(url)) continue;

        const result = transformUrl(url, mapping);
        if (result) {
          updates[field] = result.newUrl;
          docHasChanges = true;
          totalUrlsFound++;
          if (result.matched) totalMapped++;
          else totalRegexOnly++;

          auditLog.push({
            collection: config.collection,
            documentId: doc._id.toString(),
            field,
            oldUrl: url,
            newUrl: result.newUrl,
            matched: result.matched,
          });
        }
      }

      for (const field of config.arrayFields) {
        const urls = doc[field];
        if (!Array.isArray(urls)) continue;

        let arrayChanged = false;
        const newUrls = urls.map((url) => {
          if (!isCloudinaryUrl(url)) return url;
          const result = transformUrl(url, mapping);
          if (result) {
            arrayChanged = true;
            totalUrlsFound++;
            if (result.matched) totalMapped++;
            else totalRegexOnly++;
            auditLog.push({
              collection: config.collection,
              documentId: doc._id.toString(),
              field: field + "[]",
              oldUrl: url,
              newUrl: result.newUrl,
              matched: result.matched,
            });
            return result.newUrl;
          }
          return url;
        });

        if (arrayChanged) {
          updates[field] = newUrls;
          docHasChanges = true;
        }
      }

      for (const nested of config.nestedArrays) {
        const arr = doc[nested.arrayPath];
        if (!Array.isArray(arr)) continue;

        let nestedChanged = false;
        const newArr = arr.map((item, idx) => {
          const newItem = { ...item };
          for (const field of nested.fields) {
            const url = item[field];
            if (!url || !isCloudinaryUrl(url)) continue;
            const result = transformUrl(url, mapping);
            if (result) {
              newItem[field] = result.newUrl;
              nestedChanged = true;
              totalUrlsFound++;
              if (result.matched) totalMapped++;
              else totalRegexOnly++;
              auditLog.push({
                collection: config.collection,
                documentId: doc._id.toString(),
                field: nested.arrayPath + "[" + idx + "]." + field,
                oldUrl: url,
                newUrl: result.newUrl,
                matched: result.matched,
              });
            }
          }
          if (nested.arraySubFields) {
            for (const field of nested.arraySubFields) {
              const urls = item[field];
              if (!Array.isArray(urls)) continue;
              let subChanged = false;
              const newUrls = urls.map((url) => {
                if (!isCloudinaryUrl(url)) return url;
                const result = transformUrl(url, mapping);
                if (result) {
                  subChanged = true;
                  totalUrlsFound++;
                  if (result.matched) totalMapped++;
                  else totalRegexOnly++;
                  auditLog.push({
                    collection: config.collection,
                    documentId: doc._id.toString(),
                    field: nested.arrayPath + "[" + idx + "]." + field + "[]",
                    oldUrl: url,
                    newUrl: result.newUrl,
                    matched: result.matched,
                  });
                  return result.newUrl;
                }
                return url;
              });
              if (subChanged) {
                newItem[field] = newUrls;
                nestedChanged = true;
              }
            }
          }
          return newItem;
        });

        if (nestedChanged) {
          updates[nested.arrayPath] = newArr;
          docHasChanges = true;
        }
      }

      if (docHasChanges) {
        totalUpdatedDocs++;
        if (isLive) {
          await collection.updateOne({ _id: doc._id }, { $set: updates });
        }
      }
    }
  }

  console.log("\n==========================================");
  console.log("Migration Summary:");
  console.log("  Total Cloudinary URLs found: " + totalUrlsFound);
  console.log("  Matched via mapping: " + totalMapped);
  console.log("  Regex-only (fallback): " + totalRegexOnly);
  console.log("  Documents " + (isLive ? "updated" : "would update") + ": " + totalUpdatedDocs);

  fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditLog, null, 2));
  console.log("\nAudit log saved to: " + AUDIT_FILE);

  if (!isLive) {
    console.log("\n⚠️  This was a DRY RUN. Run with --live to apply updates to MongoDB.");
  } else {
    console.log("\n✅ Database migration complete! Next: run verifyMigration.js");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
