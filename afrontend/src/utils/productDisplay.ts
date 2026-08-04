import { Product } from "../types/domain";

/** Resolve the seller shop name from common API payload shapes. */
export function getProductShopName(product: Product | Record<string, any> | null | undefined): string {
  if (!product) return "";

  const direct =
    product.shopName ||
    product.storeName ||
    product.sellerName ||
    product.seller?.storeName ||
    product.seller?.sellerName ||
    product.seller?.name;

  return typeof direct === "string" ? direct.trim() : "";
}

export function isProductShopClosed(
  product: Product | Record<string, any> | null | undefined
): boolean {
  return product?.seller?.isShopOpen === false;
}

export function getProductUnavailableLabel(
  product: Product | Record<string, any> | null | undefined
): string {
  if (isProductShopClosed(product)) {
    return "Shop Closed";
  }
  if (product?.isAvailable === false) {
    return "Out of Range";
  }
  return "ADD";
}

/** True when the product may be added to cart for the current location. */
export function canAddProductToCart(
  product: Product | Record<string, any> | null | undefined
): boolean {
  if (!product) return false;
  if (isProductShopClosed(product)) return false;
  if ((product as any).isAvailable === false) return false;
  if ((product as any).isAvailableAtLocation === false) return false;
  return true;
}

/** Clean product names for compact card layouts. */
export function getProductCardDisplayName(
  product: Product | Record<string, any> | null | undefined
): string {
  const raw = (product?.name || product?.productName || "").trim();
  if (!raw) return "";

  let cleaned = raw.replace(
    /\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i,
    ""
  ).trim();

  const pack = (product?.variations?.[0]?.value || product?.pack || "").trim();
  if (pack) {
    const escapedPack = pack.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned
      .replace(new RegExp(`^${escapedPack}\\s*[-–—]?\\s*`, "i"), "")
      .trim();
  }

  cleaned = cleaned
    .replace(
      /^\d+(\.\d+)?\s*(g|kg|ml|l|ltr|litre|liter)\s+(?:\w+\s+)*(?:of\s+)?/i,
      ""
    )
    .replace(
      /^\d+(\.\d+)?\s*(pcs?|pack(?:et)?s?|pouch(?:es)?|unit(?:s)?)\s+(?:of\s+)?/i,
      ""
    )
    .trim();

  return cleaned || raw;
}
