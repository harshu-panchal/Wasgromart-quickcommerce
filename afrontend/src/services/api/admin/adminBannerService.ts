import api from "../config";

export interface Banner {
  _id: string;
  title: string;
  image: string;
  link?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BannerFormData {
  title: string;
  image: string;
  link?: string;
  order: number;
  isActive: boolean;
}

// Get all banners
export const getBanners = async (): Promise<Banner[]> => {
  try {
    console.log('[adminBannerService] Fetching banners from:', api.defaults.baseURL);
    const response = await api.get("/admin/banners");
    console.log('[adminBannerService] Banners fetched successfully:', response.data.data?.length || 0);
    return response.data.data;
  } catch (error: any) {
    console.error('[adminBannerService] Error fetching banners:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      hasAuthToken: !!error.config?.headers?.Authorization,
    });
    throw error;
  }
};

// Create banner
export const createBanner = async (data: BannerFormData): Promise<Banner> => {
  const response = await api.post("/admin/banners", data);
  return response.data.data;
};

// Update banner
export const updateBanner = async (
  id: string,
  data: Partial<BannerFormData>
): Promise<Banner> => {
  const response = await api.put(`/admin/banners/${id}`, data);
  return response.data.data;
};

// Delete banner
export const deleteBanner = async (id: string): Promise<void> => {
  await api.delete(`/admin/banners/${id}`);
};
