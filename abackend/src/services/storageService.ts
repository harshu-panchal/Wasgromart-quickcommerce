import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  UPLOAD_FOLDERS,
  UPLOAD_DIR,
  buildPublicUrl,
  ensureUploadDir,
  resolveStoragePath,
  sanitizeUploadFolder,
} from "../config/storage";

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface UploadOptions {
  folder?: string;
  mimetype?: string;
  resourceType?: "image" | "raw" | "video" | "auto";
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

function extensionFromMimetype(mimetype?: string, originalExt?: string): string {
  if (mimetype && MIME_TO_EXT[mimetype]) {
    return MIME_TO_EXT[mimetype];
  }
  if (originalExt) {
    const clean = originalExt.replace(/^\./, "").toLowerCase();
    if (/^[a-z0-9]{1,8}$/.test(clean)) {
      return clean;
    }
  }
  return "bin";
}

function writeBufferToStorage(
  buffer: Buffer,
  folder: string,
  mimetype?: string
): UploadResult {
  ensureUploadDir();

  const ext = extensionFromMimetype(mimetype);
  const filename = `${randomUUID()}.${ext}`;
  const storageKey = `${folder}/${filename}`;
  const absolutePath = resolveStoragePath(storageKey);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, buffer);

  const publicUrl = buildPublicUrl(storageKey);

  return {
    url: publicUrl,
    secureUrl: publicUrl,
    publicId: storageKey,
    format: ext,
    bytes: buffer.length,
  };
}

/**
 * Upload image from buffer (multer).
 */
export async function uploadImageFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const folder = sanitizeUploadFolder(
    options.folder,
    UPLOAD_FOLDERS.PRODUCTS
  );
  return writeBufferToStorage(buffer, folder, options.mimetype || "image/jpeg");
}

/**
 * Upload document from buffer (image or PDF).
 */
export async function uploadDocumentFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const folder = sanitizeUploadFolder(
    options.folder,
    UPLOAD_FOLDERS.SELLER_DOCUMENTS
  );
  const mimetype =
    options.mimetype ||
    (options.resourceType === "raw" ? "application/pdf" : "image/jpeg");
  return writeBufferToStorage(buffer, folder, mimetype);
}

/**
 * Upload image from local file path (seed scripts).
 */
export async function uploadImage(
  filePath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimetype =
    options.mimetype ||
    (ext === ".pdf"
      ? "application/pdf"
      : ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg");

  return uploadImageFromBuffer(buffer, { ...options, mimetype });
}

/**
 * Upload multiple images from local paths (seed scripts).
 */
export async function uploadMultipleImages(
  filePaths: string[],
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const filePath of filePaths) {
    results.push(await uploadImage(filePath, options));
  }
  return results;
}

/**
 * Upload document from local file path (seed scripts).
 */
export async function uploadDocument(
  filePath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimetype =
    options.mimetype ||
    (ext === ".pdf" ? "application/pdf" : "image/jpeg");

  return uploadDocumentFromBuffer(buffer, { ...options, mimetype });
}

/**
 * Delete a file by storage key (publicId).
 */
export async function deleteImage(storageKey: string): Promise<void> {
  const absolutePath = resolveStoragePath(storageKey);

  if (!fs.existsSync(absolutePath)) {
    return;
  }

  fs.unlinkSync(absolutePath);
}

/**
 * Delete multiple files by storage keys.
 */
export async function deleteMultipleImages(storageKeys: string[]): Promise<void> {
  for (const key of storageKeys) {
    await deleteImage(key);
  }
}

export { UPLOAD_DIR, ensureUploadDir };
