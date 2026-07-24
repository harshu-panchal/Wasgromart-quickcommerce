/**
 * Phase 4: Verify Migration — Check for Remaining Cloudinary URLs
 *
 * Connects to MongoDB and checks ALL collections with image fields
 * to ensure no Cloudinary URLs remain.
 *
 * Usage: npx ts-node src/scripts/verifyMigration.ts
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { ensureEnvLoaded } from "../config/env";

ensureEnvLoaded();

// ─── Configuration ───────────────────────────────────────────────────────────

const COLLECTIONS_TO_CHECK: {
  collection: string;
  fields: string[];
}[] = [
  { collection: "products", fields: ["mainImage", "galleryImages", "variations"] },
  { collection: "categories", fields: ["image"] },
  { collection: "subcategories", fields: ["image"] },
  { collection: "banners", fields: ["image"] },
  { collection: "brands", fields: ["image"] },
  { collection: "sellers", fields: ["profile", "idProof", "addressProof", "logo", "storeBanner"] },
  { collection: "deliveries", fields: ["drivingLicense", "nationalIdentityCard"] },
  { collection: "customers", fields: ["profilePhoto"] },
  { collection: "appsettings", fields: ["appLogo", "appFavicon"] },
  { collection: "returns", fields: ["images"] },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Phase 4: Verify Migration Results             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected!\n");

  const db = mongoose.connection.db!;
  let totalRemaining = 0;
  let totalChecked = 0;
  const issues: { collection: string; docId: string; field: string; url: string }[] = [];

  for (const config of COLLECTIONS_TO_CHECK) {
    const collection = db.collection(config.collection);

    // Build $or query for all fields
    const orConditions = config.fields.map((f) => ({
      [f]: { $regex: "res\\.cloudinary\\.com" },
    }));

    // Also check nested fields for variations
    if (config.collection === "products") {
      orConditions.push({
        "variations.mainImage": { $regex: "res\\.cloudinary\\.com" },
      });
      orConditions.push({
        "variations.galleryImages": { $regex: "res\\.cloudinary\\.com" },
      });
    }

    const query = { $or: orConditions };
    const remaining = await collection.find(query).toArray();
    totalChecked++;

    if (remaining.length === 0) {
      console.log(`✅ ${config.collection.padEnd(20)} — clean (0 Cloudinary URLs)`);
    } else {
      console.log(
        `❌ ${config.collection.padEnd(20)} — ${remaining.length} documents still have Cloudinary URLs`
      );
      totalRemaining += remaining.length;

      // Log details for first few
      for (const doc of remaining.slice(0, 5)) {
        for (const field of config.fields) {
          const val = doc[field];
          if (typeof val === "string" && val.includes("res.cloudinary.com")) {
            issues.push({
              collection: config.collection,
              docId: doc._id.toString(),
              field,
              url: val,
            });
          } else if (Array.isArray(val)) {
            for (const url of val) {
              if (
                typeof url === "string" &&
                url.includes("res.cloudinary.com")
              ) {
                issues.push({
                  collection: config.collection,
                  docId: doc._id.toString(),
                  field,
                  url,
                });
              }
            }
          }
        }
      }
    }
  }

  // Also check for new-style server URLs to confirm they're working
  console.log("\n━━━ Server URL Check ━━━");
  const productsWithServerUrls = await db
    .collection("products")
    .countDocuments({
      $or: [
        { mainImage: { $regex: "api\\.wasgromart\\.com/uploads" } },
        { galleryImages: { $regex: "api\\.wasgromart\\.com/uploads" } },
      ],
    });
  console.log(
    `📦 Products with server URLs: ${productsWithServerUrls}`
  );

  const categoriesWithServerUrls = await db
    .collection("categories")
    .countDocuments({
      image: { $regex: "api\\.wasgromart\\.com/uploads" },
    });
  console.log(
    `📦 Categories with server URLs: ${categoriesWithServerUrls}`
  );

  const bannersWithServerUrls = await db
    .collection("banners")
    .countDocuments({
      image: { $regex: "api\\.wasgromart\\.com/uploads" },
    });
  console.log(
    `📦 Banners with server URLs: ${bannersWithServerUrls}`
  );

  // Summary
  console.log("\n═══════════════════════════════════════════════════");
  if (totalRemaining === 0) {
    console.log("🎉 MIGRATION VERIFIED SUCCESSFULLY!");
    console.log("   All Cloudinary URLs have been replaced with server URLs.");
    console.log("   No remaining Cloudinary references found.");
  } else {
    console.log(`⚠️  MIGRATION INCOMPLETE!`);
    console.log(
      `   ${totalRemaining} documents still have Cloudinary URLs.`
    );

    if (issues.length > 0) {
      console.log("\n   Sample remaining Cloudinary URLs:");
      for (const issue of issues.slice(0, 10)) {
        console.log(
          `   - ${issue.collection}.${issue.field} (${issue.docId}): ${issue.url.substring(0, 80)}...`
        );
      }
    }
    console.log(
      "\n   Re-run migrateCloudinaryUrls.ts with --live to fix remaining URLs."
    );
  }

  await mongoose.disconnect();
  console.log("\n🔌 MongoDB disconnected");
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
