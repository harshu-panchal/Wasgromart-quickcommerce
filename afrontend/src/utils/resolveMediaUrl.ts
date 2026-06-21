import { getApiOrigin } from "../services/api/config";

/**
 * Resolve a media URL for display in <img src>.
 * - Full https URLs (Cloudinary legacy, server uploads) pass through unchanged
 * - Relative /uploads/ paths are prefixed with the API origin
 * - Legacy /assets/ paths pass through for frontend static files
 */
export function resolveMediaUrl(url?: string): string {
  if (!url) return "/assets/product-placeholder.jpg";
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  if (url.startsWith("/uploads/")) {
    return `${getApiOrigin()}${url}`;
  }
  if (url.startsWith("/")) {
    return url;
  }
  const origin = getApiOrigin();
  return origin ? `${origin}/${url}` : url;
}
