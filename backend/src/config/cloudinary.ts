import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate configuration
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.warn("⚠️  Cloudinary credentials not found in environment variables");
}

export default cloudinary;

// Folder structure constants
export const CLOUDINARY_FOLDERS = {
  PRODUCTS: "kosil/products",
  PRODUCT_GALLERY: "kosil/products/gallery",
  CATEGORIES: "kosil/categories",
  SUBCATEGORIES: "kosil/subcategories",
  COUPONS: "kosil/coupons",
  SELLERS: "kosil/sellers",
  SELLER_PROFILE: "kosil/sellers/profile",
  SELLER_DOCUMENTS: "kosil/sellers/documents",
  DELIVERY: "kosil/delivery",
  DELIVERY_DOCUMENTS: "kosil/delivery/documents",
  STORES: "kosil/stores",
  USERS: "kosil/users",
} as const;
