import dotenv from "dotenv";
import mongoose from "mongoose";
import Admin from "../models/Admin";

dotenv.config();

const ADMIN_MOBILE = "6268423925";
const ADMIN_EMAIL = "admin6268423925@wasgromart.com";

async function seedAdmin() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in environment");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const existing = await Admin.findOne({ mobile: ADMIN_MOBILE });

  if (existing) {
    console.log(`Admin already exists: ${existing.mobile} (${existing.email})`);
    await mongoose.disconnect();
    return;
  }

  const admin = await Admin.create({
    firstName: "Wasgro",
    lastName: "Admin",
    mobile: ADMIN_MOBILE,
    email: ADMIN_EMAIL,
    role: "Super Admin",
    password: process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123",
  });

  console.log("Admin seeded successfully:");
  console.log(`  Mobile: ${admin.mobile}`);
  console.log(`  Email:  ${admin.email}`);
  console.log(`  Role:   ${admin.role}`);
  console.log("  Login:  POST /api/v1/auth/admin/send-otp then verify with OTP 9999");

  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
