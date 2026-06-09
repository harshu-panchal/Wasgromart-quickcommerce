import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { useLocation } from "../hooks/useLocation";
import { useNavigate } from "react-router-dom";
import { Product } from "../types/domain";
import {
  getWishlist as apiGetWishlist,
  addToWishlist as apiAddToWishlist,
  removeFromWishlist as apiRemoveFromWishlist,
} from "../services/api/customerWishlistService";

/**
 * Shared wishlist state for the customer app.
 *
 * Previously every ProductCard / WishlistButton mounted its own copy of the
 * `useWishlist` hook (or duplicate inline logic) and hit `GET /customer/wishlist`
 * independently — a home page with N product cards triggered N+ identical calls.
 *
 * This provider fetches the wishlist exactly once per (auth × location) state
 * change and exposes a Set-based lookup that all consumers share.
 */

interface WishlistContextValue {
  wishlistIds: Set<string>;
  wishlistProducts: Product[];
  loading: boolean;
  isWishlisted: (productId?: string) => boolean;
  toggleWishlist: (
    productId: string,
    e?: React.MouseEvent | React.TouchEvent,
  ) => Promise<void>;
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined,
);

const productKey = (p: Product): string =>
  String((p as any)._id || (p as any).id || "");

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Dedupe concurrent fetches so multiple consumers mounting at the same time
  // share one in-flight request instead of triggering parallel duplicates.
  const inFlightRef = useRef<Promise<void> | null>(null);
  // Remember the last successful fetch key (auth + lat + lng) so we don't refetch
  // when unrelated state changes re-render the provider.
  const lastFetchKeyRef = useRef<string | null>(null);

  const setFromProducts = useCallback((products: Product[]) => {
    const list = Array.isArray(products) ? products : [];
    setWishlistProducts(list);
    setWishlistIds(new Set(list.map(productKey).filter(Boolean)));
  }, []);

  const fetchWishlist = useCallback(
    async (force = false) => {
      if (!isAuthenticated) {
        setFromProducts([]);
        lastFetchKeyRef.current = null;
        return;
      }

      const key = `auth:${isAuthenticated}|lat:${location?.latitude ?? ""}|lng:${location?.longitude ?? ""}`;
      if (!force && lastFetchKeyRef.current === key) {
        return;
      }
      if (inFlightRef.current) {
        return inFlightRef.current;
      }

      const promise = (async () => {
        try {
          setLoading(true);
          const res = await apiGetWishlist({
            latitude: location?.latitude,
            longitude: location?.longitude,
          });
          if (res?.success && res.data?.products) {
            setFromProducts(res.data.products);
            lastFetchKeyRef.current = key;
          }
        } catch (err) {
          // Silently fail; we'll retry on next state change. Don't toast since
          // this runs in the background and the user didn't initiate it.
          // eslint-disable-next-line no-console
          console.error("Failed to load wishlist", err);
        } finally {
          setLoading(false);
          inFlightRef.current = null;
        }
      })();

      inFlightRef.current = promise;
      return promise;
    },
    [isAuthenticated, location?.latitude, location?.longitude, setFromProducts],
  );

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const isWishlisted = useCallback(
    (productId?: string) => {
      if (!productId) return false;
      return wishlistIds.has(String(productId));
    },
    [wishlistIds],
  );

  const addLocal = useCallback((productId: string) => {
    setWishlistIds((prev) => {
      if (prev.has(productId)) return prev;
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  }, []);

  const removeLocal = useCallback((productId: string) => {
    setWishlistIds((prev) => {
      if (!prev.has(productId)) return prev;
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
    setWishlistProducts((prev) =>
      prev.filter((p) => productKey(p) !== productId),
    );
  }, []);

  const addToWishlist = useCallback(
    async (productId: string) => {
      if (!isAuthenticated) {
        navigate("/login");
        return;
      }
      if (!location?.latitude || !location?.longitude) {
        showToast("Location is required to add items to wishlist", "error");
        return;
      }
      const id = String(productId);
      const alreadyIn = wishlistIds.has(id);
      addLocal(id);
      try {
        const res = await apiAddToWishlist(
          id,
          location.latitude,
          location.longitude,
        );
        if (res?.success && res.data?.products) {
          setFromProducts(res.data.products);
        }
      } catch (err: any) {
        if (!alreadyIn) removeLocal(id);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update wishlist";
        showToast(msg, "error");
        throw err;
      }
    },
    [
      isAuthenticated,
      location?.latitude,
      location?.longitude,
      navigate,
      showToast,
      wishlistIds,
      addLocal,
      removeLocal,
      setFromProducts,
    ],
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      if (!isAuthenticated) {
        navigate("/login");
        return;
      }
      const id = String(productId);
      const wasIn = wishlistIds.has(id);
      const previousProducts = wishlistProducts;
      removeLocal(id);
      try {
        await apiRemoveFromWishlist(id);
      } catch (err: any) {
        if (wasIn) {
          setWishlistProducts(previousProducts);
          setWishlistIds(
            new Set(previousProducts.map(productKey).filter(Boolean)),
          );
        }
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update wishlist";
        showToast(msg, "error");
        throw err;
      }
    },
    [
      isAuthenticated,
      navigate,
      removeLocal,
      showToast,
      wishlistIds,
      wishlistProducts,
    ],
  );

  const toggleWishlist = useCallback(
    async (
      productId: string,
      e?: React.MouseEvent | React.TouchEvent,
    ): Promise<void> => {
      if (e) {
        if ("preventDefault" in e) e.preventDefault();
        if ("stopPropagation" in e) e.stopPropagation();
      }
      if (!isAuthenticated) {
        navigate("/login");
        return;
      }
      if (!productId) return;

      if (wishlistIds.has(String(productId))) {
        await removeFromWishlist(productId);
        showToast("Removed from wishlist");
      } else {
        await addToWishlist(productId);
        showToast("Added to wishlist");
      }
    },
    [
      isAuthenticated,
      navigate,
      wishlistIds,
      removeFromWishlist,
      addToWishlist,
      showToast,
    ],
  );

  const refresh = useCallback(async () => {
    await fetchWishlist(true);
  }, [fetchWishlist]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      wishlistIds,
      wishlistProducts,
      loading,
      isWishlisted,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      refresh,
    }),
    [
      wishlistIds,
      wishlistProducts,
      loading,
      isWishlisted,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      refresh,
    ],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlistContext(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlistContext must be used within a WishlistProvider");
  }
  return ctx;
}
