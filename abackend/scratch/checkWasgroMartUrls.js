const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const collections = ["products", "categories", "subcategories", "banners", "brands", "sellers"];

  let totalCount = 0;

  for (const colName of collections) {
    const col = db.collection(colName);
    
    // Find documents containing Wasgro%20mart or Wasgro mart
    const count1 = await col.countDocuments({
      $or: [
        { mainImage: { $regex: "Wasgro" } },
        { galleryImages: { $regex: "Wasgro" } },
        { image: { $regex: "Wasgro" } },
        { "variations.mainImage": { $regex: "Wasgro" } },
        { "variations.galleryImages": { $regex: "Wasgro" } }
      ]
    });

    console.log(`Collection ${colName.padEnd(15)}: ${count1} docs contain 'Wasgro'`);
    totalCount += count1;
  }

  console.log("\nTotal documents with 'Wasgro' in URLs:", totalCount);

  // Print sample product URL with Wasgro
  const sample = await db.collection("products").findOne({
    $or: [
      { mainImage: { $regex: "Wasgro" } },
      { galleryImages: { $regex: "Wasgro" } },
      { "variations.mainImage": { $regex: "Wasgro" } },
      { "variations.galleryImages": { $regex: "Wasgro" } }
    ]
  });

  if (sample) {
    console.log("\n=== Sample Product ===");
    console.log("ID:", sample._id);
    console.log("mainImage:", sample.mainImage);
    console.log("galleryImages:", sample.galleryImages);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
