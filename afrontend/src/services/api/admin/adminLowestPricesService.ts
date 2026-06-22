import api from "../config";

export interface LowestPricesProduct {
    _id: string;
    product: {
        _id: string;
        productName: string;
        mainImage?: string;
        price: number;
        mrp?: number;
        discount?: number;
        status: string;
        publish: boolean;
        headerCategoryId?: string;
    };
    headerCategorySlug: string;
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LowestPricesProductFormData {
    product: string;
    headerCategorySlug: string;
    order?: number;
    isActive: boolean;
}

export interface LowestPricesProductResponse {
    success: boolean;
    message?: string;
    data?: LowestPricesProduct | LowestPricesProduct[];
}

export const getLowestPricesProducts = async (
    headerCategorySlug?: string,
): Promise<LowestPricesProductResponse> => {
    const response = await api.get<LowestPricesProductResponse>(
        "/admin/lowest-prices-products",
        {
            params: headerCategorySlug ? { headerCategorySlug } : undefined,
        },
    );
    return response.data;
};

export const getLowestPricesProductById = async (
    id: string,
): Promise<LowestPricesProductResponse> => {
    const response = await api.get<LowestPricesProductResponse>(
        `/admin/lowest-prices-products/${id}`,
    );
    return response.data;
};

export const createLowestPricesProduct = async (
    data: LowestPricesProductFormData,
): Promise<LowestPricesProductResponse> => {
    const response = await api.post<LowestPricesProductResponse>(
        "/admin/lowest-prices-products",
        data,
    );
    return response.data;
};

export const updateLowestPricesProduct = async (
    id: string,
    data: Partial<LowestPricesProductFormData>,
): Promise<LowestPricesProductResponse> => {
    const response = await api.put<LowestPricesProductResponse>(
        `/admin/lowest-prices-products/${id}`,
        data,
    );
    return response.data;
};

export const deleteLowestPricesProduct = async (
    id: string,
): Promise<LowestPricesProductResponse> => {
    const response = await api.delete<LowestPricesProductResponse>(
        `/admin/lowest-prices-products/${id}`,
    );
    return response.data;
};

export const reorderLowestPricesProducts = async (
    products: { id: string; order: number }[],
    headerCategorySlug?: string,
): Promise<LowestPricesProductResponse> => {
    const response = await api.put<LowestPricesProductResponse>(
        "/admin/lowest-prices-products/reorder",
        { products, headerCategorySlug },
    );
    return response.data;
};
