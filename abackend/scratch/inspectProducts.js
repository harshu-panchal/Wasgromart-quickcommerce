const mongoose = require("mongoose");
const fs = require("fs");
require("dotenv").config({ path: ".env" });

const audit = JSON.parse(fs.readFileSync("migration-audit.json", "utf8"));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB!");

  const db = mongoose.connection.db;
  const products = await db.collection("products").find({}).limit(50).toArray();

  console.log(`Checking ${products.length} sample products...`);

  let withPlaceholderCount = 0;
  let withRealImageCount = 0;

  for (const p of products) {
    const auditRecord = audit.find(a => a.documentId === p._id.toString() && a.field === "mainImage");
    const oldUrl = auditRecord ? auditRecord.oldUrl : "N/A";
    const currentUrl = p.mainImage;
    const isMatched = auditRecord ? auditRecord.matched : false;

    if (isMatched) {
      withRealImageCount++;
    } else {
      withPlaceholderCount++;
      console.log(`- Product: "${p.name || p.title}"`);
      console.log(`  Current DB URL: ${currentUrl}`);
      console.log(`  Original Cloudinary URL: ${oldUrl}`);
    }
  }

  console.log("\n=== SUMMARY OF 50 SAMPLE PRODUCTS ===");
  console.log("Products with real image:", withRealImageCount);
  console.log("Products with placeholder image:", withPlaceholderCount);

  await mongoose.disconnect();
}

main();
