import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import HeaderCategory from "../models/HeaderCategory";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const mongoUri = process.env.MONGODB_URI || "mongodb+srv://wasgromart_db_user:Wasgromart123@cluster0.uwy4fvy.mongodb.net/SpeeUp?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.\n");

  try {
    console.log("--- HEADER CATEGORIES ---");
    const hcs = await HeaderCategory.find().lean();
    hcs.forEach(h => console.log(`Header Category: ${h.name} (_id: ${h._id}, status: ${h.status})`));

    console.log("\n--- ROOT CATEGORIES (parentId: null/undefined) ---");
    const rootCats = await Category.find({ parentId: { $in: [null, undefined] } }).lean();
    rootCats.forEach(c => {
      console.log(`Root Category: ${c.name} (_id: ${c._id}, headerCategoryId: ${c.headerCategoryId})`);
    });

    console.log("\n--- CHILD CATEGORIES (parentId set) ---");
    const childCats = await Category.find({ parentId: { $ne: null, $exists: true } }).lean();
    childCats.forEach(c => {
      console.log(`Child Category: ${c.name} (_id: ${c._id}, parentId: ${c.parentId}, headerCategoryId: ${c.headerCategoryId})`);
    });

    console.log("\n--- LEGACY SUBCATEGORIES (SubCategory model) ---");
    const legacySubs = await SubCategory.find().lean();
    console.log(`Total legacy subcategories: ${legacySubs.length}`);
    legacySubs.slice(0, 10).forEach(s => {
      console.log(`Legacy SubCategory: ${s.name} (_id: ${s._id}, category: ${s.category})`);
    });

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log("\nConnection closed.");
  }
}

run();
