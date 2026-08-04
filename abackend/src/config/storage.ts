import fs from "fs";
import path from "path";
import { ensureEnvLoaded } from "./env";

ensureEnvLoaded();

/**
 * Root upload directory on disk.
 * Default: sibling of nodejs/ on Hostinger (../uploads) so deploys never wipe user files.
 */
function resolveUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    const envPath = path.resolve(process.env.UPLOAD_DIR);
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }

  // Candidate paths in order of preference for Hostinger production and local dev
  const candidatePaths = [
    // Production Hostinger absolute path
    "/home/u910031778/domains/api.wasgromart.com/uploads",
    // Relative to dist/config/storage.js -> nodejs/../uploads = api.wasgromart.com/uploads
    path.resolve(__dirname, "../../../uploads"),
    path.resolve(__dirname, "../../uploads"),
    // Relative to process.cwd()
    path.resolve(process.cwd(), "../uploads"),
    path.resolve(process.cwd(), "uploads"),
  ];

  // Prioritize directory containing actual subfolders like 'speeup' or 'categories' or 'products'
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      if (
        fs.existsSync(path.join(candidate, "speeup")) ||
        fs.existsSync(path.join(candidate, "categories")) ||
        fs.existsSync(path.join(candidate, "products"))
      ) {
        return candidate;
      }
    }
  }

  // Fallback to first candidate that exists
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), "../uploads");
}

export const UPLOAD_DIR = resolveUploadDir();

/**
 * Public base URL for uploaded files (no trailing slash).
 * Used to build absolute URLs returned to clients.
 */
export const PUBLIC_UPLOAD_BASE_URL = (
  process.env.PUBLIC_UPLOAD_BASE_URL ||
  process.env.API_PUBLIC_URL ||
  "https://api.wasgromart.com"
).replace(/\/$/, "");

/** Logical upload folders (mapped to subdirectories under UPLOAD_DIR). */
export const UPLOAD_FOLDERS = {
  PRODUCTS: "products",
  PRODUCT_GALLERY: "products/gallery",
  PRODUCT_VARIANTS: "products/variants",
  PRODUCT_VARIANTS_GALLERY: "products/variants/gallery",
  CATEGORIES: "categories",
  SUBCATEGORIES: "subcategories",
  COUPONS: "coupons",
  SELLERS: "sellers",
  SELLER_PROFILE: "sellers/profile",
  SELLER_DOCUMENTS: "sellers/documents",
  DELIVERY: "delivery",
  DELIVERY_DOCUMENTS: "delivery/documents",
  STORES: "stores",
  USERS: "users",
  BANNERS: "banners",
  BRANDS: "brands",
  PROMOTIONS: "promotions",
  CUSTOMER_PROFILES: "customer_profiles",
} as const;

/** Allowed folder path prefixes (whitelist for security). */
const ALLOWED_FOLDER_PREFIXES = new Set(
  Object.values(UPLOAD_FOLDERS).map((f) => f.toLowerCase())
);

/** Map legacy frontend folder strings to canonical upload paths. */
const FOLDER_ALIASES: Record<string, string> = {
  products: UPLOAD_FOLDERS.PRODUCTS,
  "products/gallery": UPLOAD_FOLDERS.PRODUCT_GALLERY,
  "products/variants": UPLOAD_FOLDERS.PRODUCT_VARIANTS,
  "products/variants/gallery": UPLOAD_FOLDERS.PRODUCT_VARIANTS_GALLERY,
  "wasgro-mart/products": UPLOAD_FOLDERS.PRODUCTS,
  "wasgro-mart/products/gallery": UPLOAD_FOLDERS.PRODUCT_GALLERY,
  "wasgro-mart/products/variants": UPLOAD_FOLDERS.PRODUCT_VARIANTS,
  "wasgro-mart/products/variants/gallery":
    UPLOAD_FOLDERS.PRODUCT_VARIANTS_GALLERY,
  "wasgro-mart/categories": UPLOAD_FOLDERS.CATEGORIES,
  "wasgro-mart/subcategories": UPLOAD_FOLDERS.SUBCATEGORIES,
  "wasgro-mart/coupons": UPLOAD_FOLDERS.COUPONS,
  "wasgro-mart/banners": UPLOAD_FOLDERS.BANNERS,
  "wasgro-mart/brands": UPLOAD_FOLDERS.BRANDS,
  "wasgro-mart/stores": UPLOAD_FOLDERS.STORES,
  "wasgro-mart/promotion-banners": UPLOAD_FOLDERS.PROMOTIONS,
  customer_profiles: UPLOAD_FOLDERS.CUSTOMER_PROFILES,
  // Legacy kosil/cloudinary paths
  "kosil/products": UPLOAD_FOLDERS.PRODUCTS,
  "kosil/products/gallery": UPLOAD_FOLDERS.PRODUCT_GALLERY,
  "kosil/categories": UPLOAD_FOLDERS.CATEGORIES,
  "kosil/subcategories": UPLOAD_FOLDERS.SUBCATEGORIES,
  "kosil/coupons": UPLOAD_FOLDERS.COUPONS,
  "kosil/sellers": UPLOAD_FOLDERS.SELLERS,
  "kosil/sellers/profile": UPLOAD_FOLDERS.SELLER_PROFILE,
  "kosil/sellers/documents": UPLOAD_FOLDERS.SELLER_DOCUMENTS,
  "kosil/delivery": UPLOAD_FOLDERS.DELIVERY,
  "kosil/delivery/documents": UPLOAD_FOLDERS.DELIVERY_DOCUMENTS,
  "kosil/stores": UPLOAD_FOLDERS.STORES,
  "kosil/users": UPLOAD_FOLDERS.USERS,
};

function normalizeFolderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\s+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

/**
 * Sanitize and validate an upload folder from client input.
 * Returns a safe relative path under UPLOAD_DIR.
 */
export function sanitizeUploadFolder(
  raw: string | undefined,
  fallback: string = UPLOAD_FOLDERS.PRODUCTS
): string {
  if (!raw || !raw.trim()) {
    return fallback;
  }

  const normalized = normalizeFolderKey(raw);

  if (normalized.includes("..") || normalized.includes("\0")) {
    throw new Error("Invalid upload folder path");
  }

  if (FOLDER_ALIASES[normalized]) {
    return FOLDER_ALIASES[normalized];
  }

  // Direct match against allowed prefixes
  for (const allowed of ALLOWED_FOLDER_PREFIXES) {
    if (normalized === allowed || normalized.startsWith(`${allowed}/`)) {
      return normalized;
    }
  }

  throw new Error(`Upload folder not allowed: ${raw}`);
}

/**
 * Create UPLOAD_DIR if missing. Idempotent — never deletes existing files.
 */
export function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Resolve a storage key (e.g. "products/uuid.webp") to an absolute filesystem path.
 * Throws if path escapes UPLOAD_DIR.
 */
export function resolveStoragePath(storageKey: string): string {
  const normalized = storageKey
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "");

  if (!normalized || normalized.includes("\0")) {
    throw new Error("Invalid storage path");
  }

  const absolute = path.resolve(UPLOAD_DIR, normalized);
  const uploadRoot = path.resolve(UPLOAD_DIR);

  if (
    absolute !== uploadRoot &&
    !absolute.startsWith(uploadRoot + path.sep)
  ) {
    throw new Error("Storage path escapes upload directory");
  }

  return absolute;
}

/** Build public URL for a storage key. */
export function buildPublicUrl(storageKey: string): string {
  const key = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${PUBLIC_UPLOAD_BASE_URL}/uploads/${key}`;
}
