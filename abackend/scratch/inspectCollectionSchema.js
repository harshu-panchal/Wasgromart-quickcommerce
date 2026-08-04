const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const sample = await db.collection("products").findOne({});
  console.log("Product document keys:", Object.keys(sample || {}));
  console.log("Sample product document:", JSON.stringify(sample, null, 2).slice(0, 1000));

  await mongoose.disconnect();
}

main();
