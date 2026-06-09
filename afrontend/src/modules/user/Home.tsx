import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import HomeHero from "./components/HomeHero";
import HomeBannerCarousel from "./components/HomeBannerCarousel";
import PromoSection from "./components/PromoSection";
import LowestPricesEver from "./components/LowestPricesEver";
import CategoryTileSection from "./components/CategoryTileSection";
import FeaturedThisWeek from "./components/FeaturedThisWeek";
import ProductCard from "./components/ProductCard";
import HomeProductSection from "./components/HomeProductSection";
import {
  getHomeContent,
  getHomeSections,
  getHomeSectionProducts,
  HomeSection,
} from "../../services/api/customerHomeService";
import { getHeaderCategoriesPublic } from "../../services/api/headerCategoryService";
import { useLocation } from "../../hooks/useLocation";
import { useLoading } from "../../context/LoadingContext";
import PageLoader from "../../components/PageLoader";

import { useThemeContext } from "../../context/ThemeContext";

// Chunked-loading constants.
//  - First load fetches `SECTIONS_PAGE_SIZE` sections; we then load another
//    page each time the user scrolls into a "trigger" section.
//  - Each section is fetched with `PRODUCTS_PER_SECTION` products and reveals
//    `PRODUCTS_PER_SECTION` more whenever "See More" is clicked.
const SECTIONS_PAGE_SIZE = 5;
const PRODUCTS_PER_SECTION = 6;
// Trigger the next page when the user reaches the section that is this many
// items from the end of the currently-loaded list. With `SECTIONS_PAGE_SIZE: 5`
// and `LOAD_MORE_TRIGGER_OFFSET: 3` the trigger lives on the 3rd section.
const LOAD_MORE_TRIGGER_OFFSET = 3;

export default function Home() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { activeCategory, setActiveCategory } = useThemeContext();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { startRouteLoading, stopRouteLoading } = useLoading();
  const activeTab = activeCategory;
  const setActiveTab = setActiveCategory;
  const contentRef = useRef<HTMLDivElement>(null);

  // State for dynamic data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<any>({
    bestsellers: [],
    categories: [],
    homeSections: [],
    shops: [],
    promoBanners: [],
    trending: [],
    cookingIdeas: [],
  });

  const [products, setProducts] = useState<any[]>([]);

  // Section-level pagination state.
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [sectionsPage, setSectionsPage] = useState(1);
  const [hasMoreSections, setHasMoreSections] = useState(false);
  const [loadingMoreSections, setLoadingMoreSections] = useState(false);
  // Guard concurrent loads (e.g. observer firing twice rapidly).
  const sectionsLoadingRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Reset chunked state whenever activeTab / location changes.
        setSections([]);
        setSectionsPage(1);
        setHasMoreSections(false);

        const response = await getHomeContent(
          activeTab,
          location?.latitude,
          location?.longitude,
          true,
          5 * 60 * 1000,
          false,
          {
            sectionsLimit: SECTIONS_PAGE_SIZE,
            productsPerSection: PRODUCTS_PER_SECTION,
          },
        );
        if (response.success && response.data) {
          setHomeData(response.data);
          setSections((response.data.homeSections || []) as HomeSection[]);
          setHasMoreSections(
            Boolean(response.data.homeSectionsPagination?.hasMore),
          );
          setSectionsPage(1);

          if (response.data.bestsellers) {
            setProducts(response.data.bestsellers);
          }
        } else {
          setError("Failed to load content. Please try again.");
        }
      } catch (err) {
        console.error("Failed to fetch home content", err);
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Preload PromoSection data for other header categories in the background
    // so tab switches feel instant. We use the same chunked params so the
    // cache key matches what the home page actually consumes.
    const preloadHeaderCategories = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const headerCategories = await getHeaderCategoriesPublic(true);
        const slugsToPreload = [
          "all",
          ...headerCategories.map((cat) => cat.slug),
        ];
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
                {
                  sectionsLimit: SECTIONS_PAGE_SIZE,
                  productsPerSection: PRODUCTS_PER_SECTION,
                },
              ).catch((err) => {
                console.debug(`Failed to preload data for ${slug}:`, err);
              }),
            ),
          );
          if (i + batchSize < slugsToPreload.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      } catch (err) {
        console.debug("Failed to preload header categories:", err);
      }
    };

    preloadHeaderCategories();
  }, [location?.latitude, location?.longitude, activeTab]);

  // Load the next page of sections. Triggered both by the IntersectionObserver
  // sentinel and (defensively) on a manual fallback.
  const loadMoreSections = useCallback(async () => {
    if (sectionsLoadingRef.current) return;
    if (!hasMoreSections) return;
    sectionsLoadingRef.current = true;
    setLoadingMoreSections(true);
    try {
      const nextPage = sectionsPage + 1;
      const response = await getHomeSections(
        nextPage,
        SECTIONS_PAGE_SIZE,
        PRODUCTS_PER_SECTION,
        activeTab,
        location?.latitude,
        location?.longitude,
      );
      if (response.success && response.data) {
        setSections((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const fresh = (response.data.sections || []).filter(
            (s) => !existingIds.has(s.id),
          );
          return [...prev, ...fresh];
        });
        setSectionsPage(nextPage);
        setHasMoreSections(Boolean(response.data.pagination?.hasMore));
      }
    } catch (err) {
      console.error("Failed to load more sections", err);
    } finally {
      setLoadingMoreSections(false);
      sectionsLoadingRef.current = false;
    }
  }, [
    activeTab,
    hasMoreSections,
    location?.latitude,
    location?.longitude,
    sectionsPage,
  ]);

  // IntersectionObserver: fire `loadMoreSections` when the user scrolls to the
  // trigger section (3rd from the end of the currently-loaded list).
  const triggerSectionRef = useRef<HTMLDivElement | null>(null);
  const triggerSectionId = useMemo(() => {
    if (!hasMoreSections || sections.length === 0) return null;
    // For the very first batch (size 5), pin the trigger to the 3rd section
    // so the user gets the "load more after 3rd" UX described in the spec.
    // For subsequent batches, place it 3-from-end so loading stays just-in-time.
    if (sections.length <= SECTIONS_PAGE_SIZE) {
      const idx = Math.min(
        sections.length - 1,
        Math.max(0, LOAD_MORE_TRIGGER_OFFSET - 1),
      );
      return sections[idx]?.id ?? null;
    }
    const idx = Math.max(0, sections.length - LOAD_MORE_TRIGGER_OFFSET);
    return sections[idx]?.id ?? null;
  }, [sections, hasMoreSections]);

  useEffect(() => {
    if (!triggerSectionRef.current || !hasMoreSections) return;
    const node = triggerSectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadMoreSections();
            break;
          }
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [triggerSectionId, hasMoreSections, loadMoreSections]);

  // "See More" handler for a single section — appends the next page of
  // products in-place via the dedicated paginated endpoint.
  const handleSeeMoreProducts = useCallback(
    async (sectionId: string) => {
      const target = sections.find((s) => s.id === sectionId);
      if (!target) return;
      const nextPage = (target.pagination?.page || 1) + 1;
      try {
        const response = await getHomeSectionProducts(
          sectionId,
          nextPage,
          PRODUCTS_PER_SECTION,
          location?.latitude,
          location?.longitude,
        );
        if (response.success && response.data) {
          setSections((prev) =>
            prev.map((s) => {
              if (s.id !== sectionId) return s;
              const existingIds = new Set(
                s.data.map((p: any) => String(p.id || p._id)),
              );
              const fresh = (response.data.products || []).filter(
                (p: any) => !existingIds.has(String(p.id || p._id)),
              );
              return {
                ...s,
                data: [...s.data, ...fresh],
                pagination: response.data.pagination,
              };
            }),
          );
        }
      } catch (err) {
        console.error("Failed to load more section products", err);
      }
    },
    [sections, location?.latitude, location?.longitude],
  );

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
    return <PageLoader />;
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
      <HomeHero activeTab={activeTab} onTabChange={setActiveTab} />

      <HomeBannerCarousel banners={homeData.promoBanners} />

      <LowestPricesEver
        activeTab={activeTab}
        products={homeData.lowestPrices}
      />

      <PromoSection activeTab={activeTab} />

      <div
        ref={contentRef}
        className="bg-neutral-50 -mt-2 pt-1 space-y-5 md:space-y-8 md:pt-4">
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

        {(activeTab === "all" || sections.length > 0) && (
          <>
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

            {/* Dynamic Home Sections - chunked: loaded a page at a time as the
                user scrolls. The IntersectionObserver targets the
                `triggerSectionId` calculated above. */}
            {sections.length > 0 && (
              <>
                {sections.map((section: any) => {
                  if (!section.data || section.data.length === 0) return null;

                  const columnCount = Number(section.columns) || 4;
                  const isTrigger = section.id === triggerSectionId;
                  const refProp = isTrigger
                    ? { ref: triggerSectionRef as any }
                    : {};

                  if (
                    section.displayType === "products" &&
                    section.data &&
                    section.data.length > 0
                  ) {
                    return (
                      <div key={section.id} {...refProp}>
                        <HomeProductSection
                          title={section.title}
                          products={section.data}
                          columnCount={columnCount}
                          initialCount={PRODUCTS_PER_SECTION}
                          step={PRODUCTS_PER_SECTION}
                          hasMore={Boolean(section.pagination?.hasMore)}
                          onSeeMore={
                            section.pagination
                              ? () => handleSeeMoreProducts(section.id)
                              : undefined
                          }
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={section.id} {...refProp}>
                      <CategoryTileSection
                        title={section.title}
                        tiles={section.data || []}
                        columns={columnCount as 2 | 3 | 4 | 6 | 8}
                        showProductCount={false}
                      />
                    </div>
                  );
                })}

                {loadingMoreSections && (
                  <div className="flex justify-center py-6">
                    <span className="inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            )}

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
    </div>
  );
}
