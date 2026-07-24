/**
 * Phase 4: Verify Migration (Plain JS)
 * Usage: node src/scripts/verifyMigration.js
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const COLLECTIONS_TO_CHECK = [
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

async function main() {
  console.log("Phase 4: Verify Migration Results");
  console.log("=================================\n");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected!\n");

  const db = mongoose.connection.db;
  let totalRemaining = 0;

  for (const config of COLLECTIONS_TO_CHECK) {
    const collection = db.collection(config.collection);

    const orConditions = config.fields.map((f) => ({
      [f]: { $regex: "res\\.cloudinary\\.com" },
    }));

    if (config.collection === "products") {
      orConditions.push({ "variations.mainImage": { $regex: "res\\.cloudinary\\.com" } });
      orConditions.push({ "variations.galleryImages": { $regex: "res\\.cloudinary\\.com" } });
    }

    const remaining = await collection.find({ $or: orConditions }).toArray();

    if (remaining.length === 0) {
      console.log("✅ " + config.collection.padEnd(20) + " — clean (0 Cloudinary URLs)");
    } else {
      console.log("❌ " + config.collection.padEnd(20) + " — " + remaining.length + " documents still have Cloudinary URLs");
      totalRemaining += remaining.length;
    }
  }

  console.log("\nServer URL Verification:");
  const productsWithServer = await db.collection("products").countDocuments({
    $or: [
      { mainImage: { $regex: "api\\.wasgromart\\.com/uploads" } },
      { galleryImages: { $regex: "api\\.wasgromart\\.com/uploads" } },
    ],
  });
  console.log("  Products using server URLs: " + productsWithServer);

  const categoriesWithServer = await db.collection("categories").countDocuments({
    image: { $regex: "api\\.wasgromart\\.com/uploads" },
  });
  console.log("  Categories using server URLs: " + categoriesWithServer);

  const bannersWithServer = await db.collection("banners").countDocuments({
    image: { $regex: "api\\.wasgromart\\.com/uploads" },
  });
  console.log("  Banners using server URLs: " + bannersWithServer);

  console.log("\n==========================================");
  if (totalRemaining === 0) {
    console.log("🎉 ALL CLOUDINARY URLS SUCCESSFULLY MIGRATED TO LOCAL SERVER!");
  } else {
    console.log("⚠️  Migration incomplete: " + totalRemaining + " documents still contain Cloudinary URLs.");
    console.log("Run: node src/scripts/migrateCloudinaryUrls.js --live");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
