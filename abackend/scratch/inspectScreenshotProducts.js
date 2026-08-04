const mongoose = require("mongoose");
const fs = require("fs");
require("dotenv").config({ path: ".env" });

const audit = JSON.parse(fs.readFileSync("migration-audit.json", "utf8"));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB!");

  const db = mongoose.connection.db;

  const searchTerms = ["OPPO", "Kechaoda", "Foneme", "Snexian", "JMAX"];
  
  for (const term of searchTerms) {
    const products = await db.collection("products").find({
      productName: { $regex: term, $options: "i" }
    }).toArray();

    console.log(`\n=== SEARCH RESULTS FOR: "${term}" (${products.length} found) ===`);
    for (const p of products) {
      const name = p.productName;
      const currentUrl = p.mainImage || "";
      
      const auditRecord = audit.find(a => a.documentId === p._id.toString() && a.field === "mainImage");
      const oldUrl = auditRecord ? auditRecord.oldUrl : "N/A";

      // Check if file exists locally in uploads/
      const relPath = currentUrl ? currentUrl.replace("https://api.wasgromart.com/uploads/", "") : "";
      const localPath = "d:/AppZeto/wasgromart/uploads/" + relPath;
      const localExists = relPath ? (fs.existsSync(localPath) || fs.existsSync(decodeURIComponent(localPath))) : false;

      console.log(`- Product: "${name}"`);
      console.log(`  Current DB URL: ${currentUrl || "(NULL)"}`);
      console.log(`  Original Cloudinary URL: ${oldUrl}`);
      console.log(`  Local file exists on disk: ${localExists}`);
    }
  }

  await mongoose.disconnect();
}

main();
