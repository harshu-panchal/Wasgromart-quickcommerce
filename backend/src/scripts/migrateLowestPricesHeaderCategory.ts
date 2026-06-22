import dotenv from "dotenv";
import mongoose from "mongoose";
import LowestPricesProduct from "../models/LowestPricesProduct";

dotenv.config();

/**
 * One-time migration: add headerCategorySlug to existing lowest-prices rows.
 *
 * Usage: npx ts-node src/scripts/migrateLowestPricesHeaderCategory.ts
 */
async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database");

  const collection = LowestPricesProduct.collection;

  const updateResult = await collection.updateMany(
    {
      $or: [
        { headerCategorySlug: { $exists: false } },
        { headerCategorySlug: null },
        { headerCategorySlug: "" },
      ],
    },
    { $set: { headerCategorySlug: "all" } },
  );
  console.log(`Updated ${updateResult.modifiedCount} document(s) with headerCategorySlug: "all"`);

  const indexes = await collection.indexes();
  const productOnlyUnique = indexes.find(
    (idx) =>
      idx.unique &&
      idx.key &&
      Object.keys(idx.key).length === 1 &&
      idx.key.product === 1,
  );

  if (productOnlyUnique && productOnlyUnique.name) {
    await collection.dropIndex(productOnlyUnique.name);
    console.log(`Dropped old unique index: ${productOnlyUnique.name}`);
  }

  await LowestPricesProduct.syncIndexes();
  console.log("Synced indexes (compound unique on product + headerCategorySlug)");

  const finalIndexes = await collection.indexes();
  console.log(
    "Current indexes:",
    finalIndexes.map((i) => i.name),
  );

  await mongoose.disconnect();
  console.log("Migration complete");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
