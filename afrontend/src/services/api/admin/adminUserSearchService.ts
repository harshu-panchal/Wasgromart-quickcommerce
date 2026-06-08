import api from "../config";
import { ApiResponse } from "./types";

export type AdminSearchUserType =
  | "Customer"
  | "Seller"
  | "Delivery"
  | "Admin";

export interface AdminUserSearchHit {
  userId: string;
  userType: AdminSearchUserType;
  displayName: string;
  phone?: string;
  email?: string;
}

export interface SearchUsersParams {
  q: string;
  type?: AdminSearchUserType;
}

/**
 * Search across Customer / Seller / Delivery / Admin collections for the
 * admin "Specific User" picker. Backend returns up to 20 hits.
 */
export const searchUsers = async (
  params: SearchUsersParams,
): Promise<ApiResponse<AdminUserSearchHit[]>> => {
  const response = await api.get<ApiResponse<AdminUserSearchHit[]>>(
    "/admin/users/search",
    { params },
  );
  return response.data;
};
