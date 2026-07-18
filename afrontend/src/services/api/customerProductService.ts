import api from './config';
import { Product } from './productService'; // Reuse generic product type if compatible or define new one
import { apiCache } from '../../utils/apiCache';

export interface Category {
    _id: string; // MongoDB ID
    id?: string; // Virtual ID
    name: string;
    parent?: string | null;
    image?: string;
    icon?: string;
    description?: string;
    isActive: boolean;
    children?: Category[];
    subcategories?: Category[];
    headerCategoryId?: string | { _id: string; name?: string };
    totalProducts?: number;
}

export interface GetProductsParams {
    search?: string;
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: 'price_asc' | 'price_desc' | 'popular' | 'discount';
    page?: number;
    limit?: number;
    latitude?: number; // User location latitude
    longitude?: number; // User location longitude
}

export interface ProductListResponse {
    success: boolean;
    message?: string;
    data: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface ProductDetailResponse {
    success: boolean;
    message?: string;
    data: Product & { similarProducts?: Product[] };
}

export interface CategoryListResponse {
    success: boolean;
    data: Category[];
}

function includeStoredLocation(
    params: GetProductsParams = {}
): GetProductsParams {
    if (
        params.latitude !== undefined &&
        params.longitude !== undefined
    ) {
        return params;
    }

    try {
        const stored = localStorage.getItem('userLocation');
        if (!stored) return params;
        const location = JSON.parse(stored);
        if (
            Number.isFinite(location?.latitude) &&
            Number.isFinite(location?.longitude)
        ) {
            return {
                ...params,
                latitude: location.latitude,
                longitude: location.longitude,
            };
        }
    } catch {
        // A missing or malformed cached location should not block browsing.
    }

    return params;
}

/**
 * Get products with filters (Public)
 * The current cached location is included automatically for nearby-first ordering.
 */
export const getProducts = async (params?: GetProductsParams): Promise<ProductListResponse> => {
    const response = await api.get<ProductListResponse>('/customer/products', {
        params: includeStoredLocation(params),
    });
    return response.data;
};

/**
 * Get product details by ID (Public)
 * Location (latitude/longitude) is required to verify product availability
 */
export const getProductById = async (id: string, latitude?: number, longitude?: number): Promise<ProductDetailResponse> => {
    const params: any = {};
    if (latitude !== undefined && longitude !== undefined) {
        params.latitude = latitude;
        params.longitude = longitude;
    }
    const response = await api.get<ProductDetailResponse>(`/customer/products/${id}`, { params });
    return response.data;
};

/**
 * Get category details by ID or slug (Public)
 */
export const getCategoryById = async (id: string): Promise<any> => {
    const response = await api.get<any>(`/customer/categories/${id}`);
    return response.data;
};

/**
 * Get all categories (Public)
 * Using /tree endpoint to get hierarchy if available, otherwise just /
 * Cached for 10 minutes as categories don't change frequently
 */
export const getCategories = async (tree: boolean = false): Promise<CategoryListResponse> => {
    const cacheKey = `customer-categories-${tree ? 'tree' : 'list'}`;
    return apiCache.getOrFetch(
        cacheKey,
        async () => {
    const url = tree ? '/customer/categories/tree' : '/customer/categories';
    const response = await api.get<CategoryListResponse>(url);
    return response.data;
        },
        10 * 60 * 1000 // 10 minutes cache
    );
};
