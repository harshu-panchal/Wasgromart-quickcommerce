import api from "./config";
import { apiCache } from "../../utils/apiCache";

export interface HomeSectionPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface HomeSection {
  id: string;
  title: string;
  slug?: string;
  displayType: "subcategories" | "products" | "categories";
  columns?: number;
  data: any[];
  /** Only present when the server was asked to paginate this section. */
  pagination?: HomeSectionPagination;
}

export interface HomeContentResponse {
  success: boolean;
  data: {
    bestsellers: any[];
    lowestPrices?: any[];
    categories: any[];
    homeSections?: HomeSection[];
    /** Only present when the server was asked to chunk the section list. */
    homeSectionsPagination?: HomeSectionPagination;
    shops: any[];
    promoBanners: any[];
    trending: any[];
    cookingIdeas: any[];
    promoCards?: any[];
    promoStrip?: any;
  };
}

export interface GetHomeContentOptions {
  /** Cap on number of home sections to return in this request. 0 = no cap. */
  sectionsLimit?: number;
  /** Cap on products inside each home section. 0 = use section's admin limit. */
  productsPerSection?: number;
}

/**
 * Get home page content with caching.
 *
 * Pass `sectionsLimit` / `productsPerSection` to enable chunked loading.
 * Leaving them undefined preserves the legacy "fetch everything" behaviour
 * used by Categories.tsx, Search.tsx and PromoSection.tsx.
 */
export const getHomeContent = async (
  headerCategorySlug?: string,
  latitude?: number,
  longitude?: number,
  useCache: boolean = true,
  cacheTTL: number = 5 * 60 * 1000, // 5 minutes
  skipLoader: boolean = false,
  options: GetHomeContentOptions = {}
): Promise<HomeContentResponse> => {
  const { sectionsLimit, productsPerSection } = options;
  const cacheKey = `home-content-${headerCategorySlug || "all"}-${latitude || 0}-${longitude || 0}-${sectionsLimit ?? 0}-${productsPerSection ?? 0}`;

  const fetchFn = async () => {
    const params: any = headerCategorySlug ? { headerCategorySlug } : {};
    if (latitude !== undefined && longitude !== undefined) {
      params.latitude = latitude;
      params.longitude = longitude;
    }
    if (sectionsLimit && sectionsLimit > 0) {
      params.sectionsLimit = sectionsLimit;
    }
    if (productsPerSection && productsPerSection > 0) {
      params.productsPerSection = productsPerSection;
    }
    const response = await api.get<HomeContentResponse>("/customer/home", {
      params,
      skipLoader,
    } as any);
    return response.data;
  };

  if (useCache) {
    return apiCache.getOrFetch(cacheKey, fetchFn, cacheTTL);
  }

  return fetchFn();
};

export interface HomePromoStripResponse {
  success: boolean;
  data: {
    promoStrip: any | null;
  };
}

/** Lightweight promo strip fetch — avoids loading the full home payload per tab. */
export const getHomePromoStrip = async (
  headerCategorySlug?: string,
  latitude?: number,
  longitude?: number,
  useCache: boolean = true,
  cacheTTL: number = 5 * 60 * 1000,
): Promise<HomePromoStripResponse> => {
  const cacheKey = `home-promo-strip-${headerCategorySlug || "all"}-${latitude || 0}-${longitude || 0}`;

  const fetchFn = async () => {
    const params: Record<string, string | number> = headerCategorySlug
      ? { headerCategorySlug }
      : {};
    if (latitude !== undefined && longitude !== undefined) {
      params.latitude = latitude;
      params.longitude = longitude;
    }
    const response = await api.get<HomePromoStripResponse>(
      "/customer/home/promo-strip",
      { params, skipLoader: true } as any,
    );
    return response.data;
  };

  if (useCache) {
    return apiCache.getOrFetch(cacheKey, fetchFn, cacheTTL);
  }

  return fetchFn();
};

export interface HomeSectionsResponse {
  success: boolean;
  data: {
    sections: HomeSection[];
    pagination: HomeSectionPagination;
  };
}

/**
 * Fetch a single page of home sections (each populated with the first
 * `productsPerSection` products). Used to lazily load more sections as the
 * user scrolls through the home page.
 */
export const getHomeSections = async (
  page: number,
  limit: number = 5,
  productsPerSection: number = 6,
  headerCategorySlug?: string,
  latitude?: number,
  longitude?: number,
  skipLoader: boolean = true
): Promise<HomeSectionsResponse> => {
  const params: any = { page, limit, productsPerSection };
  if (headerCategorySlug) params.headerCategorySlug = headerCategorySlug;
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const response = await api.get<HomeSectionsResponse>(
    "/customer/home/sections",
    { params, skipLoader } as any
  );
  return response.data;
};

export interface HomeSectionProductsResponse {
  success: boolean;
  data: {
    sectionId: string;
    title: string;
    displayType: string;
    products: any[];
    pagination: HomeSectionPagination;
  };
}

/**
 * Fetch a single page of products inside a specific home section. Used by the
 * "See More" button on the home page.
 */
export const getHomeSectionProducts = async (
  sectionId: string,
  page: number,
  limit: number = 6,
  latitude?: number,
  longitude?: number,
  skipLoader: boolean = true
): Promise<HomeSectionProductsResponse> => {
  const params: any = { page, limit };
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const response = await api.get<HomeSectionProductsResponse>(
    `/customer/home/sections/${sectionId}/products`,
    { params, skipLoader } as any
  );
  return response.data;
};

/**
 * Get products for a specific "shop" (e.g. Spiritual Store)
 */
export const getStoreProducts = async (
  storeId: string,
  latitude?: number,
  longitude?: number
): Promise<any> => {
  const params: any = {};
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const response = await api.get(`/customer/home/store/${storeId}`, { params });
  return response.data;
};
