export function extractShopName(seller: unknown): string | null {
  if (!seller || typeof seller !== "object") {
    return null;
  }

  const record = seller as Record<string, unknown>;
  const name =
    (typeof record.storeName === "string" && record.storeName) ||
    (typeof record.sellerName === "string" && record.sellerName) ||
    (typeof record.name === "string" && record.name) ||
    null;

  return name ? name.trim() : null;
}

export function withShopPresentation<T extends Record<string, any>>(product: T): T & {
  shopName: string | null;
  storeName: string | null;
} {
  const shopName = extractShopName(product.seller);
  return {
    ...product,
    shopName,
    storeName: shopName,
  };
}
