import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ProductCard from './components/ProductCard';
import { getProducts } from '../../services/api/customerProductService';
import { getHomeContent } from '../../services/api/customerHomeService';
import { Product } from '../../types/domain';
import { useLocation } from '../../hooks/useLocation';

export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { location } = useLocation();
  const searchQuery = searchParams.get('q') || '';
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [cookingIdeas, setCookingIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset pagination when search query or location changes
  useEffect(() => {
    if (searchQuery.trim()) {
      setSearchResults([]);
      setPage(1);
      setHasMore(true);
      setTotalProducts(0);
    }
  }, [searchQuery, location?.latitude, location?.longitude]);

  // Fetch products based on search query
  const fetchProducts = useCallback(async (pageNum: number) => {
    if (!searchQuery.trim()) {
      return;
    }

    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const params: any = { search: searchQuery, page: pageNum, limit: 20 };
      // Include user location for seller service radius filtering
      if (location?.latitude && location?.longitude) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }
      const response = await getProducts(params);
      const newProducts = response.data as unknown as Product[];
      
      if (pageNum === 1) {
        setSearchResults(newProducts);
      } else {
        setSearchResults(prev => [...prev, ...newProducts]);
      }
      
      setTotalProducts(response.pagination?.total || 0);
      setHasMore(newProducts.length === 20 && (pageNum * 20 < (response.pagination?.total || 0)));
    } catch (error) {
      console.error('Error searching products:', error);
      if (pageNum === 1) setSearchResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, location?.latitude, location?.longitude]);

  useEffect(() => {
    if (searchQuery.trim()) {
      fetchProducts(page);
    }
  }, [fetchProducts, page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadingMore]);



  // Fetch trending/home content for initial view
  useEffect(() => {
    const fetchInitialContent = async () => {
      try {
        const response = await getHomeContent(
          undefined,
          location?.latitude,
          location?.longitude
        );
        if (response.success && response.data) {
          setTrendingItems(response.data.trending || []);
          setCookingIdeas(response.data.cookingIdeas || []);
        }
      } catch (error) {
        console.error("Error fetching search initial content", error);
      } finally {
        setContentLoading(false);
      }
    };

    if (!searchQuery.trim()) {
      fetchInitialContent();
    }
  }, [searchQuery, location?.latitude, location?.longitude]);

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">

      {/* Search Results */}
      {searchQuery.trim() && (
        <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
          <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6">
            Search Results {totalProducts > 0 && `(${totalProducts})`}
          </h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {searchResults.map((product, index) => (
                  <ProductCard
                    key={`${product.id}-${index}`}
                    product={product}
                    categoryStyle={true}
                    showBadge={true}
                    showPackBadge={false}
                    showStockInfo={true}
                  />
                ))}
              </div>
              
              {/* Invisible element to trigger loading more */}
              <div ref={observerTarget} className="h-4 mt-4 w-full" />
              
              {loadingMore && (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 md:py-16 text-neutral-500">
              <p className="text-lg md:text-xl mb-2">No products found</p>
              <p className="text-sm md:text-base">Try a different search term</p>
            </div>
          )}
        </div>
      )}

      {/* Trending in your city */}
      {!searchQuery.trim() && (
        <>
          {contentLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          )}

          {!contentLoading && trendingItems.length > 0 && (
            <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
              <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6">Trending in your city</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
                {trendingItems.map((item) => (
                  <div
                    key={item.id || item._id}
                    className="bg-white rounded-lg border-2 border-green-600 p-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(item.type === 'category' ? `/category/${item.id || item._id}` : `/product/${item.id || item._id}`)}
                  >
                    <div className="w-full h-24 rounded-lg mb-2 overflow-hidden bg-neutral-50 flex items-center justify-center">
                      {item.image || item.imageUrl ? (
                        <img
                          src={item.image || item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-contain bg-white rounded-sm"
                        />
                      ) : (
                        <div className="text-4xl">🔥</div>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-neutral-900 text-center line-clamp-2">
                      {item.name || item.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* See all products - Placeholder or link to popular items */}
          <div className="px-4 md:px-6 lg:px-8 py-2 md:py-4">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 cursor-pointer" onClick={() => navigate('/category/all')}>
              <span className="text-sm md:text-base text-neutral-700 font-medium whitespace-nowrap">Browse all categories ▸</span>
            </div>
          </div>

          {/* Cooking ideas */}
          {!contentLoading && cookingIdeas.length > 0 && (
            <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
              <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6">Cooking ideas</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {cookingIdeas.map((idea, idx) => (
                  <div key={idea.id || idea._id || idx} className="relative rounded-lg overflow-hidden aspect-[4/3] bg-neutral-100 cursor-pointer" onClick={() => navigate(`/product/${idea.productId || idea.id}`)}>
                    {idea.image && <img src={idea.image} alt={idea.title} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-bold line-clamp-2">{idea.title}</div>
                    <button className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
