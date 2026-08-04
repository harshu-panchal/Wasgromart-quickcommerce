import api, { ApiResponse } from "./config";

export interface PublicConfig {
  appName: string;
  appLogo?: string;
  appFavicon?: string;
  contactEmail: string;
  contactPhone: string;
  supportEmail?: string;
  supportPhone?: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  features?: {
    sellerRegistration: boolean;
    productApproval: boolean;
    orderTracking: boolean;
    wallet: boolean;
    coupons: boolean;
  };
}

export const getPublicConfig = async (): Promise<ApiResponse<PublicConfig>> => {
  const response = await api.get<ApiResponse<PublicConfig>>("/config/public");
  return response.data;
};
