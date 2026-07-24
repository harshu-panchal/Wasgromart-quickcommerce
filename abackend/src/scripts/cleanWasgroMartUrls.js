/**
 * Clean Wasgro mart / Wasgro%20mart prefix from MongoDB Image URLs
 * Converts: https://api.wasgromart.com/uploads/Wasgro%20mart/products/...
 * Into:     https://api.wasgromart.com/uploads/products/...
 *
 * Usage:
 *   node src/scripts/cleanWasgroMartUrls.js          # Dry run
 *   node src/scripts/cleanWasgroMartUrls.js --live   # Update DB
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const COLLECTIONS_TO_CLEAN = [
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

function hasWasgroPrefix(url) {
  return url && typeof url === "string" && (url.includes("/uploads/Wasgro%20mart/") || url.includes("/uploads/Wasgro%20Mart/") || url.includes("/uploads/Wasgro mart/"));
}

function cleanUrl(url) {
  if (!hasWasgroPrefix(url)) return url;
  return url
    .replace("/uploads/Wasgro%20mart/", "/uploads/")
    .replace("/uploads/Wasgro%20Mart/", "/uploads/")
    .replace("/uploads/Wasgro mart/", "/uploads/");
}

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("Cleaning Wasgro mart prefix from MongoDB URLs");
  console.log("==================================================");
  if (!isLive) {
    console.log("DRY RUN MODE — no database changes will be made");
    console.log("Add --live argument to update the database\n");
  } else {
    console.log("🔴 LIVE MODE — database WILL be updated!\n");
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
  let totalUpdatedDocs = 0;
  let totalUrlsCleaned = 0;

  for (const config of COLLECTIONS_TO_CLEAN) {
    const collection = db.collection(config.collection);

    const orConditions = [
      { [config.collection]: { $regex: "Wasgro" } }
    ];

    const docs = await collection.find({
      $or: [
        ...config.simpleFields.map(f => ({ [f]: { $regex: "Wasgro" } })),
        ...config.arrayFields.map(f => ({ [f]: { $regex: "Wasgro" } })),
        ...config.nestedArrays.flatMap(n => [
          ...n.fields.map(f => ({ [`${n.arrayPath}.${f}`]: { $regex: "Wasgro" } })),
          ...(n.arraySubFields || []).map(f => ({ [`${n.arrayPath}.${f}`]: { $regex: "Wasgro" } }))
        ])
      ]
    }).toArray();

    if (docs.length === 0) continue;

    console.log(`--- ${config.collection.toUpperCase()} (${docs.length} documents found) ---`);

    for (const doc of docs) {
      const updates = {};
      let docHasChanges = false;

      for (const field of config.simpleFields) {
        const url = doc[field];
        if (hasWasgroPrefix(url)) {
          updates[field] = cleanUrl(url);
          docHasChanges = true;
          totalUrlsCleaned++;
        }
      }

      for (const field of config.arrayFields) {
        const urls = doc[field];
        if (Array.isArray(urls)) {
          let arrayChanged = false;
          const newUrls = urls.map(u => {
            if (hasWasgroPrefix(u)) {
              arrayChanged = true;
              totalUrlsCleaned++;
              return cleanUrl(u);
            }
            return u;
          });
          if (arrayChanged) {
            updates[field] = newUrls;
            docHasChanges = true;
          }
        }
      }

      for (const nested of config.nestedArrays) {
        const arr = doc[nested.arrayPath];
        if (Array.isArray(arr)) {
          let nestedChanged = false;
          const newArr = arr.map(item => {
            const newItem = { ...item };
            for (const field of nested.fields) {
              if (hasWasgroPrefix(item[field])) {
                newItem[field] = cleanUrl(item[field]);
                nestedChanged = true;
                totalUrlsCleaned++;
              }
            }
            if (nested.arraySubFields) {
              for (const field of nested.arraySubFields) {
                const urls = item[field];
                if (Array.isArray(urls)) {
                  let subChanged = false;
                  const newUrls = urls.map(u => {
                    if (hasWasgroPrefix(u)) {
                      subChanged = true;
                      totalUrlsCleaned++;
                      return cleanUrl(u);
                    }
                    return u;
                  });
                  if (subChanged) {
                    newItem[field] = newUrls;
                    nestedChanged = true;
                  }
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
  console.log("Cleanup Summary:");
  console.log("  Total URLs cleaned: " + totalUrlsCleaned);
  console.log("  Documents " + (isLive ? "updated" : "would update") + ": " + totalUpdatedDocs);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
