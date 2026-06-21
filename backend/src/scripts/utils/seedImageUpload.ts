import path from "path";
import fs from "fs";
import { ensureEnvLoaded } from "../../config/env";
import { UPLOAD_FOLDERS } from "../../config/storage";
import { uploadImage } from "../../services/storageService";

ensureEnvLoaded();

type UploadFolder = (typeof UPLOAD_FOLDERS)[keyof typeof UPLOAD_FOLDERS];

/** Resolve a script-local path to an absolute filesystem path. */
export function resolveAssetPath(
  localPath: string,
  assetsBase: string,
  subfolder?: string
): string {
  if (path.isAbsolute(localPath) && fs.existsSync(localPath)) {
    return localPath;
  }

  if (localPath.startsWith("/assets/")) {
    return path.join(assetsBase, localPath.replace(/^\/assets\//, ""));
  }

  if (subfolder) {
    return path.join(assetsBase, subfolder, path.basename(localPath));
  }

  return path.join(assetsBase, path.basename(localPath));
}

/**
 * Upload a local image file to server storage for seed scripts.
 * Returns secureUrl on success, or a legacy /assets/ fallback path if file missing.
 */
export async function uploadLocalImageForSeed(
  localPath: string,
  folder: UploadFolder | string = UPLOAD_FOLDERS.CATEGORIES,
  assetsBasePath?: string
): Promise<string> {
  if (localPath.startsWith("http://") || localPath.startsWith("https://")) {
    return localPath;
  }

  const basename = path.basename(localPath);
  let fullPath = localPath;

  if (assetsBasePath) {
    fullPath = path.join(assetsBasePath, basename);
    if (!fs.existsSync(fullPath) && localPath.includes("/")) {
      fullPath = path.join(assetsBasePath, localPath.replace(/^\/+/, ""));
    }
  } else if (!path.isAbsolute(localPath)) {
    fullPath = path.resolve(localPath);
  }

  if (!fs.existsSync(fullPath)) {
    return localPath.startsWith("/")
      ? localPath
      : `/assets/${basename}`;
  }

  try {
    const result = await uploadImage(fullPath, { folder });
    return result.secureUrl;
  } catch {
    return localPath.startsWith("/")
      ? localPath
      : `/assets/${basename}`;
  }
}

export { UPLOAD_FOLDERS };

/** Drop-in replacement for legacy uploadToCloudinary in seed scripts. */
export async function uploadSeedImage(
  localPath: string,
  folder: UploadFolder | string = UPLOAD_FOLDERS.PRODUCTS,
  assetsBase?: string,
  subfolder?: string
): Promise<string | null> {
  if (localPath.startsWith("http://") || localPath.startsWith("https://")) {
    return localPath;
  }

  const fullPath = assetsBase
    ? resolveAssetPath(localPath, assetsBase, subfolder)
    : localPath;

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    const result = await uploadImage(fullPath, { folder });
    return result.secureUrl;
  } catch {
    return null;
  }
}
