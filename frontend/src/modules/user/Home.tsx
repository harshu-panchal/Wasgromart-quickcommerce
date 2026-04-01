import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HomeHero from "./components/HomeHero";
import HomeBannerCarousel from "./components/HomeBannerCarousel";
import PromoStrip from "./components/PromoStrip";
import LowestPricesEver from "./components/LowestPricesEver";
import CategoryTileSection from "./components/CategoryTileSection";
import FeaturedThisWeek from "./components/FeaturedThisWeek";
import ProductCard from "./components/ProductCard";
import { getHomeContent } from "../../services/api/customerHomeService";
import { getHeaderCategoriesPublic } from "../../services/api/headerCategoryService";
import { useLocation } from "../../hooks/useLocation";
import { useLoading } from "../../context/LoadingContext";
import PageLoader from "../../components/PageLoader";

import { useThemeContext } from "../../context/ThemeContext";

export default function Home() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { activeCategory, setActiveCategory } = useThemeContext();
  const { startRouteLoading, stopRouteLoading } = useLoading();
  const activeTab = activeCategory; // mapping for existing code compatibility
  const setActiveTab = setActiveCategory;
  const contentRef = useRef<HTMLDivElement>(null);

  // State for dynamic data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<any>({
    bestsellers: [],
    categories: [],
    homeSections: [], // Dynamic sections created by admin
    shops: [],
    promoBanners: [],
    trending: [],
    cookingIdeas: [],
  });

  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getHomeContent(
          activeTab,
          location?.latitude,
          location?.longitude,
        );
        if (response.success && response.data) {
          setHomeData(response.data);

          if (response.data.bestsellers) {
            setProducts(response.data.bestsellers);
          }
        } else {
          setError("Failed to load content. Please try again.");
        }
      } catch (error) {
        console.error("Failed to fetch home content", error);
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Preload PromoStrip data for all header categories in the background
    // This ensures instant loading when users switch tabs
    const preloadHeaderCategories = async () => {
      try {
        // Wait a bit after initial load to not interfere with main content
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const headerCategories = await getHeaderCategoriesPublic(true);
        // Preload data for each header category (including 'all')
        const slugsToPreload = [
          "all",
          ...headerCategories.map((cat) => cat.slug),
        ];

        // Preload in batches to avoid overwhelming the network
        const batchSize = 2;
        for (let i = 0; i < slugsToPreload.length; i += batchSize) {
          const batch = slugsToPreload.slice(i, i + batchSize);
          await Promise.all(
            batch.map((slug) =>
              getHomeContent(
                slug,
                location?.latitude,
                location?.longitude,
                true,
                5 * 60 * 1000,
                true,
              ).catch((err) => {
                // Silently fail - this is just preloading
                console.debug(`Failed to preload data for ${slug}:`, err);
              }),
            ),
          );
          // Small delay between batches
          if (i + batchSize < slugsToPreload.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      } catch (error) {
        // Silently fail - preloading is optional
        console.debug("Failed to preload header categories:", error);
      }
    };

    preloadHeaderCategories();
  }, [location?.latitude, location?.longitude, activeTab]);

  const getFilteredProducts = (tabId: string) => {
    if (tabId === "all") {
      return products;
    }
    return products.filter(
      (p) =>
        p.categoryId === tabId ||
        (p.category && (p.category._id === tabId || p.category.slug === tabId)),
    );
  };

  const filteredProducts = useMemo(
    () => getFilteredProducts(activeTab),
    [activeTab, products],
  );

  if (loading && !products.length) {
    return <PageLoader />; // Let the global IconLoader handle the initial loading state
  }

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-10 h-10 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Oops! Something went wrong
        </h3>
        <p className="text-gray-600 mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 transition-colors">
          Try Refreshing
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20 md:pb-0" ref={contentRef}>
      {/* Hero Header with Gradient and Tabs */}
      <HomeHero activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Promo Strip */}
      <PromoStrip activeTab={activeTab} />

      {/* Static Banners Carousel */}
      <HomeBannerCarousel banners={homeData.promoBanners} />

      {/* LOWEST PRICES EVER Section */}
      <LowestPricesEver
        activeTab={activeTab}
        products={homeData.lowestPrices}
      />

      {/* Main content */}
      <div
        ref={contentRef}
        className="bg-neutral-50 -mt-2 pt-1 space-y-5 md:space-y-8 md:pt-4">
        {/* Filtered Products Section (from bestsellers) */}
        {activeTab !== "all" && filteredProducts.length > 0 && (
          <div data-products-section className="mt-6 mb-6 md:mt-8 md:mb-8">
            <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
              {activeTab === "grocery" ? "Grocery Items" : activeTab}
            </h2>
            <div className="px-4 md:px-6 lg:px-8">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      categoryStyle={true}
                      showBadge={true}
                      showPackBadge={false}
                      showStockInfo={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 md:py-16 text-neutral-500">
                  <p className="text-lg md:text-xl mb-2">No products found</p>
                  <p className="text-sm md:text-base">
                    Try selecting a different category
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Sections */}
        {(activeTab === "all" || (homeData.homeSections && homeData.homeSections.length > 0)) && (
          <>
            {/* Sections only for 'All' tab */}
            {activeTab === "all" && (
              <>
                <div className="mt-2 md:mt-4">
                  <CategoryTileSection
                    title="Bestsellers"
                    tiles={
                      homeData.bestsellers && homeData.bestsellers.length > 0
                        ? homeData.bestsellers.slice(0, 6).map((card: any) => ({
                          id: card.id,
                          categoryId: card.categoryId,
                          name: card.name || "Category",
                          productImages: card.productImages || [],
                          productCount: card.productCount || 0,
                        }))
                        : []
                    }
                    columns={3}
                    showProductCount={true}
                  />
                </div>

                <FeaturedThisWeek />
              </>
            )}

            {/* Dynamic Home Sections - Render sections created by admin (all tabs) */}
            {homeData.homeSections && homeData.homeSections.length > 0 && (
              <>
                {homeData.homeSections.map((section: any) => {
                  if (!section.data || section.data.length === 0) return null;

                  const columnCount = Number(section.columns) || 4;

                  if (
                    section.displayType === "products" &&
                    section.data &&
                    section.data.length > 0
                  ) {
                    const gridClass =
                      {
                        2: "grid-cols-2",
                        3: "grid-cols-3",
                        4: "grid-cols-4",
                        6: "grid-cols-6",
                        8: "grid-cols-8",
                      }[columnCount] || "grid-cols-4";

                    const isCompact = columnCount >= 4;
                    const gapClass = columnCount >= 4 ? "gap-2" : "gap-3 md:gap-4";

                    return (
                      <div key={section.id} className="mt-6 mb-6 md:mt-8 md:mb-8">
                        {section.title && (
                          <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
                            {section.title}
                          </h2>
                        )}
                        <div className="px-4 md:px-6 lg:px-8">
                          <div className={`grid ${gridClass} ${gapClass}`}>
                            {section.data.map((product: any) => (
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
                        </div>
                      </div>
                    );
                  }

                  return (
                    <CategoryTileSection
                      key={section.id}
                      title={section.title}
                      tiles={section.data || []}
                      columns={columnCount as 2 | 3 | 4 | 6 | 8}
                      showProductCount={false}
                    />
                  );
                })}
              </>
            )}

            {/* Shop by Store Section - only on 'all' tab */}
            {activeTab === "all" && (
              <div className="mb-6 mt-6 md:mb-8 md:mt-8">
                <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight">
                  Shop by Store
                </h2>
                <div className="px-4 md:px-6 lg:px-8">
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-4">
                    {(homeData.shops || []).map((tile: any) => {
                      const hasImages =
                        tile.image ||
                        (tile.productImages &&
                          tile.productImages.filter(Boolean).length > 0);

                      return (
                        <div key={tile.id} className="flex flex-col">
                          <div
                            onClick={() => {
                              const storeSlug =
                                tile.slug || tile.id.replace("-store", "");
                              navigate(`/store/${storeSlug}`);
                            }}
                            className="block bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                            {hasImages ? (
                              <img
                                src={
                                  tile.image ||
                                  (tile.productImages ? tile.productImages[0] : "")
                                }
                                alt={tile.name}
                                className="w-full h-16 object-cover"
                              />
                            ) : (
                              <div
                                className={`w-full h-16 flex items-center justify-center text-3xl text-neutral-300 ${tile.bgColor || "bg-neutral-50"
                                  }`}>
                                {tile.name.charAt(0)}
                              </div>
                            )}
                          </div>

                          <div className="mt-1.5 text-center">
                            <span className="text-xs font-semibold text-neutral-900 line-clamp-2 leading-tight">
                              {tile.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div >
  );
}
