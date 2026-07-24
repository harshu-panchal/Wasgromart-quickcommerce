/**
 * Phase 3: Migrate Cloudinary URLs in MongoDB to Local Server URLs
 *
 * Connects to MongoDB, finds all documents with Cloudinary image URLs,
 * and replaces them with local server URLs.
 *
 * Usage:
 *   npx ts-node src/scripts/migrateCloudinaryUrls.ts              # Dry run (default)
 *   npx ts-node src/scripts/migrateCloudinaryUrls.ts --live        # Actually update DB
 *
 * Prerequisites: Run buildCloudinaryMap.ts first to generate cloudinary-map.json
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { ensureEnvLoaded } from "../config/env";

ensureEnvLoaded();

// ─── Configuration ───────────────────────────────────────────────────────────

const MAP_FILE = path.resolve(__dirname, "../../cloudinary-map.json");
const AUDIT_FILE = path.resolve(__dirname, "../../migration-audit.json");
const SERVER_BASE_URL = "https://api.wasgromart.com/uploads";

// Known Cloudinary cloud names used by this project
const CLOUDINARY_CLOUD_NAMES = ["dv1l9sb4p", "dpfkjdyy6"];

// Regex to match any Cloudinary URL and extract the path
// Handles: https?://res.cloudinary.com/{cloud}/{type}/upload/{transforms}/v{version}/{path}
const CLOUDINARY_URL_REGEX =
  /https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video|raw)\/upload(?:\/[^/]+)*\/v\d+\/(.+)/;

// ─── Types ───────────────────────────────────────────────────────────────────

interface MappingEntry {
  cloudinaryUrl: string;
  publicId: string;
  format: string;
  localFilePath: string;
  serverFolder: string;
  serverKey: string;
  serverUrl: string;
  fileExists: boolean;
  bytes: number;
}

interface AuditEntry {
  collection: string;
  documentId: string;
  field: string;
  oldUrl: string;
  newUrl: string;
  matched: boolean; // true if found in mapping, false if regex-only
}

// All collections and their image fields to migrate
const COLLECTIONS_TO_MIGRATE: {
  collection: string;
  model: string;
  simpleFields: string[];
  arrayFields: string[];
  nestedArrays: { arrayPath: string; fields: string[]; arraySubFields?: string[] }[];
}[] = [
  {
    collection: "products",
    model: "Product",
    simpleFields: ["mainImage"],
    arrayFields: ["galleryImages"],
    nestedArrays: [
      {
        arrayPath: "variations",
        fields: ["mainImage"],
        arraySubFields: ["galleryImages"],
      },
    ],
  },
  {
    collection: "categories",
    model: "Category",
    simpleFields: ["image"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "subcategories",
    model: "SubCategory",
    simpleFields: ["image"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "banners",
    model: "Banner",
    simpleFields: ["image"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "brands",
    model: "Brand",
    simpleFields: ["image"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "sellers",
    model: "Seller",
    simpleFields: ["profile", "idProof", "addressProof", "logo", "storeBanner"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "deliveries",
    model: "Delivery",
    simpleFields: ["drivingLicense", "nationalIdentityCard"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "customers",
    model: "Customer",
    simpleFields: ["profilePhoto"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "appsettings",
    model: "AppSettings",
    simpleFields: ["appLogo", "appFavicon"],
    arrayFields: [],
    nestedArrays: [],
  },
  {
    collection: "returns",
    model: "Return",
    simpleFields: [],
    arrayFields: ["images"],
    nestedArrays: [],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isCloudinaryUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return url.includes("res.cloudinary.com");
}

function transformUrl(
  url: string,
  mapping: Record<string, MappingEntry>
): { newUrl: string; matched: boolean } | null {
  if (!isCloudinaryUrl(url)) return null;

  // Try exact match in mapping first
  if (mapping[url]) {
    return { newUrl: mapping[url].serverUrl, matched: true };
  }

  // Try regex extraction as fallback
  const match = url.match(CLOUDINARY_URL_REGEX);
  if (match) {
    const pathWithExt = match[1]; // e.g., "banners/abc123.jpg"
    const newUrl = `${SERVER_BASE_URL}/${pathWithExt}`;
    return { newUrl, matched: false };
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Phase 3: Migrate Cloudinary URLs in MongoDB        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  if (!isLive) {
    console.log("🔍 DRY RUN MODE — no database changes will be made");
    console.log("   Add --live to actually update the database");
  } else {
    console.log("🔴 LIVE MODE — database WILL be updated!");
  }
  console.log();

  // 1. Load mapping
  let mapping: Record<string, MappingEntry> = {};
  if (fs.existsSync(MAP_FILE)) {
    mapping = JSON.parse(fs.readFileSync(MAP_FILE, "utf-8"));
    console.log(
      `📋 Loaded mapping with ${Object.keys(mapping).length} URL entries`
    );
  } else {
    console.log("⚠️  No cloudinary-map.json found — using regex-only mode");
    console.log("   (URLs will be transformed but no file existence check)");
  }
  console.log();

  // 2. Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected!\n");

  const db = mongoose.connection.db!;
  const auditLog: AuditEntry[] = [];
  let totalUrlsFound = 0;
  let totalMapped = 0;
  let totalRegexOnly = 0;
  let totalUpdatedDocs = 0;

  // 3. Process each collection
  for (const config of COLLECTIONS_TO_MIGRATE) {
    console.log(`\n━━━ ${config.collection.toUpperCase()} ━━━`);

    const collection = db.collection(config.collection);

    // Build a query to find documents with any Cloudinary URL
    const orConditions: any[] = [];
    for (const field of config.simpleFields) {
      orConditions.push({ [field]: { $regex: "res\\.cloudinary\\.com" } });
    }
    for (const field of config.arrayFields) {
      orConditions.push({ [field]: { $regex: "res\\.cloudinary\\.com" } });
    }
    for (const nested of config.nestedArrays) {
      for (const field of nested.fields) {
        orConditions.push({
          [`${nested.arrayPath}.${field}`]: {
            $regex: "res\\.cloudinary\\.com",
          },
        });
      }
      if (nested.arraySubFields) {
        for (const field of nested.arraySubFields) {
          orConditions.push({
            [`${nested.arrayPath}.${field}`]: {
              $regex: "res\\.cloudinary\\.com",
            },
          });
        }
      }
    }

    if (orConditions.length === 0) {
      console.log("   No image fields configured, skipping.");
      continue;
    }

    const query = { $or: orConditions };
    const docs = await collection.find(query).toArray();
    console.log(
      `   Found ${docs.length} documents with Cloudinary URLs`
    );

    if (docs.length === 0) continue;

    for (const doc of docs) {
      const updates: Record<string, any> = {};
      let docHasChanges = false;

      // Process simple fields
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

          console.log(
            `   ${result.matched ? "✅" : "🔶"} ${field}: ${url.substring(0, 60)}...`
          );
          console.log(
            `      → ${result.newUrl.substring(0, 60)}...`
          );
        }
      }

      // Process array fields
      for (const field of config.arrayFields) {
        const urls = doc[field];
        if (!Array.isArray(urls)) continue;

        let arrayChanged = false;
        const newUrls = urls.map((url: string) => {
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
              field: `${field}[]`,
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

      // Process nested arrays (e.g., variations[].mainImage, variations[].galleryImages)
      for (const nested of config.nestedArrays) {
        const arr = doc[nested.arrayPath];
        if (!Array.isArray(arr)) continue;

        let nestedChanged = false;
        const newArr = arr.map((item: any, idx: number) => {
          const newItem = { ...item };

          // Process simple fields in nested object
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
                field: `${nested.arrayPath}[${idx}].${field}`,
                oldUrl: url,
                newUrl: result.newUrl,
                matched: result.matched,
              });
            }
          }

          // Process array fields in nested object
          if (nested.arraySubFields) {
            for (const field of nested.arraySubFields) {
              const urls = item[field];
              if (!Array.isArray(urls)) continue;

              let subChanged = false;
              const newUrls = urls.map((url: string) => {
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
                    field: `${nested.arrayPath}[${idx}].${field}[]`,
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

      // Apply updates
      if (docHasChanges) {
        totalUpdatedDocs++;
        if (isLive) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: updates }
          );
        }
      }
    }
  }

  // 4. Print summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("📊 Migration Summary:");
  console.log(`   📝 Total Cloudinary URLs found: ${totalUrlsFound}`);
  console.log(`   ✅ Matched via mapping: ${totalMapped}`);
  console.log(`   🔶 Regex-only (no mapping match): ${totalRegexOnly}`);
  console.log(`   📄 Documents ${isLive ? "updated" : "would update"}: ${totalUpdatedDocs}`);
  console.log();

  // Per-collection summary
  const collectionCounts: Record<string, number> = {};
  for (const entry of auditLog) {
    collectionCounts[entry.collection] =
      (collectionCounts[entry.collection] || 0) + 1;
  }
  console.log("📁 URLs by collection:");
  for (const [coll, count] of Object.entries(collectionCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`   ${coll.padEnd(20)} ${count} URLs`);
  }

  // 5. Save audit log
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditLog, null, 2));
  console.log(`\n💾 Audit log saved to: ${AUDIT_FILE}`);
  console.log(`   (${auditLog.length} URL changes logged)`);

  if (!isLive) {
    console.log(
      "\n⚠️  This was a DRY RUN. No changes were made to the database."
    );
    console.log("   Review the audit log, then run with --live to apply.");
  } else {
    console.log("\n✅ Phase 3 complete! Database has been updated.");
    console.log("   Next: run verifyMigration.ts");
  }

  await mongoose.disconnect();
  console.log("🔌 MongoDB disconnected");
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
