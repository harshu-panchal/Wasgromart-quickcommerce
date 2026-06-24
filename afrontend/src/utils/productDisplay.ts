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
