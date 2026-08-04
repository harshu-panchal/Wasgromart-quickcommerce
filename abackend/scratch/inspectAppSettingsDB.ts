import mongoose from "mongoose";
import connectDB from "../src/config/db";
import AppSettings from "../src/models/AppSettings";

async function main() {
  await connectDB();
  console.log("=== INSPECTING APP SETTINGS IN MONGODB ===");
  const count = await AppSettings.countDocuments();
  console.log(`Total AppSettings documents: ${count}`);

  const allSettings = await AppSettings.find();
  console.log("Documents in appsettings collection:");
  console.log(JSON.stringify(allSettings, null, 2));

  mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
