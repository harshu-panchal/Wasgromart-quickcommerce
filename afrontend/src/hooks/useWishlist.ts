import { useCallback } from "react";
import { useWishlistContext } from "../context/WishlistContext";

/**
 * Hook for wishlist-toggle UI bound to a single product.
 *
 * This is a thin wrapper over `WishlistContext` so we only ever hit
 * `GET /customer/wishlist` once per session, no matter how many cards or
 * heart buttons are mounted.
 */
export function useWishlist(productId?: string) {
  const { isWishlisted, toggleWishlist: ctxToggle } = useWishlistContext();

  const toggleWishlist = useCallback(
    async (e?: React.MouseEvent | React.TouchEvent) => {
      if (!productId) {
        // eslint-disable-next-line no-console
        console.error("Product ID is required to toggle wishlist");
        return;
      }
      await ctxToggle(productId, e);
    },
    [productId, ctxToggle],
  );

  return {
    isWishlisted: isWishlisted(productId),
    toggleWishlist,
  };
}
