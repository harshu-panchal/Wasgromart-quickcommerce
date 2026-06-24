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

/** Resolve seller id whether the field is populated or a raw ObjectId. */
export function normalizeSellerId(seller: unknown): string | null {
  if (!seller) return null;

  if (typeof seller === "string") {
    return seller;
  }

  if (typeof seller === "object") {
    const record = seller as { _id?: unknown; toString?: () => string };
    if (record._id) {
      return String(record._id);
    }
    if (typeof record.toString === "function") {
      const value = record.toString();
      if (value && value !== "[object Object]") {
        return value;
      }
    }
  }

  return null;
}

export function isSellerInRange(
  seller: unknown,
  nearbySellerIds: Array<{ toString(): string }>
): boolean {
  const sellerId = normalizeSellerId(seller);
  if (!sellerId || nearbySellerIds.length === 0) {
    return false;
  }
  return nearbySellerIds.some((id) => id.toString() === sellerId);
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
