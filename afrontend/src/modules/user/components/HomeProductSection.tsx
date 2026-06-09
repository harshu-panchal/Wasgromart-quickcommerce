import { useMemo, useState } from "react";
import ProductCard from "./ProductCard";

interface HomeProductSectionProps {
  title?: string;
  products: any[];
  columnCount: number;
  /** How many products to show on first render (client-side mode only). */
  initialCount?: number;
  /** Increment when "See More" is clicked (client-side mode only). */
  step?: number;
  /**
   * When provided, "See More" calls this instead of revealing locally cached
   * products. The parent is responsible for fetching the next page and
   * appending it to `products`. `hasMore` controls button visibility.
   */
  onSeeMore?: () => Promise<void> | void;
  /** Server-driven flag: whether the section still has more products. */
  hasMore?: boolean;
}

const HomeProductSection: React.FC<HomeProductSectionProps> = ({
  title,
  products,
  columnCount,
  initialCount = 6,
  step = 6,
  onSeeMore,
  hasMore: hasMoreServer,
}) => {
  const isServerDriven = typeof onSeeMore === "function";
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [loadingMore, setLoadingMore] = useState(false);

  const gridClass = useMemo(
    () =>
    ({
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
      6: "grid-cols-6",
      8: "grid-cols-8",
    }[columnCount] || "grid-cols-4"),
    [columnCount],
  );

  const isCompact = columnCount >= 4;
  const gapClass = columnCount >= 4 ? "gap-2" : "gap-3 md:gap-4";

  // In server-driven mode we trust the parent to manage how many products are
  // loaded; render all of them. In client-driven mode we slice locally so the
  // "See More" button can reveal them progressively without an API call.
  const visibleProducts = isServerDriven
    ? products
    : products.slice(0, visibleCount);

  const hasMore = isServerDriven
    ? Boolean(hasMoreServer)
    : visibleCount < products.length;

  const handleSeeMore = async () => {
    if (isServerDriven) {
      if (loadingMore) return;
      try {
        setLoadingMore(true);
        await onSeeMore!();
      } finally {
        setLoadingMore(false);
      }
      return;
    }
    setVisibleCount((prev) => Math.min(prev + step, products.length));
  };

  if (!products || products.length === 0) return null;

  return (
    <div className="mt-6 mb-6 md:mt-8 md:mb-8">
      {title && (
        <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
          {title}
        </h2>
      )}
      <div className="px-4 md:px-6 lg:px-8">
        <div className={`grid ${gridClass} ${gapClass}`}>
          {visibleProducts.map((product: any) => (
            <ProductCard
              key={product.id || product._id}
              product={product}
              categoryStyle={true}
              showBadge={true}
              showPackBadge={false}
              showStockInfo={false}
              compact={isCompact}
            />
          ))}
        </div>

        {hasMore && (
          <div className="mt-4 md:mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleSeeMore}
              disabled={loadingMore}
              className="px-6 py-2 text-sm md:text-base font-semibold text-green-700 border border-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {loadingMore && (
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {loadingMore ? "Loading…" : "See More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeProductSection;
