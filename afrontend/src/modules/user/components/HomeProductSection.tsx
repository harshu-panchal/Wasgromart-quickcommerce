import { useState, useMemo } from "react";
import ProductCard from "./ProductCard";

interface HomeProductSectionProps {
  title?: string;
  products: any[];
  columnCount: number;
  initialCount?: number;
  step?: number;
}

const HomeProductSection: React.FC<HomeProductSectionProps> = ({
  title,
  products,
  columnCount,
  initialCount = 6,
  step = 6,
}) => {
  const [visibleCount, setVisibleCount] = useState(initialCount);

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

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  const handleSeeMore = () => {
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
              className="px-6 py-2 text-sm md:text-base font-semibold text-green-700 border border-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors"
            >
              See More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeProductSection;
