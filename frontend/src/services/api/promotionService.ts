import api from "./config";

export interface PromotionRequest {
  _id: string;
  title: string;
  image: string;
  link?: string;
  order: number;
  isActive: boolean;
  status: "Pending" | "Approved" | "Rejected";
  rejectionReason?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  seller?: {
    _id: string;
    sellerName?: string;
    storeName?: string;
    logo?: string;
  };
}

export interface CreatePromotionPayload {
  title: string;
  image: string;
  link?: string;
  order?: number;
}

export const submitPromotionRequest = async (
  payload: CreatePromotionPayload
): Promise<PromotionRequest> => {
  const response = await api.post("/promotions", payload);
  return response.data.data;
};

export const getMyPromotionRequests = async (): Promise<PromotionRequest[]> => {
  const response = await api.get("/promotions/mine");
  return response.data.data;
};

export const listPromotionRequests = async (
  status?: "Pending" | "Approved" | "Rejected"
): Promise<PromotionRequest[]> => {
  const response = await api.get("/admin/promotion-requests", {
    params: status ? { status } : undefined,
  });
  return response.data.data;
};

export const approvePromotionRequest = async (
  id: string,
  payload?: { order?: number; link?: string; title?: string }
): Promise<PromotionRequest> => {
  const response = await api.patch(`/admin/promotion-requests/${id}/approve`, payload || {});
  return response.data.data;
};

export const rejectPromotionRequest = async (
  id: string,
  reason?: string
): Promise<PromotionRequest> => {
  const response = await api.patch(`/admin/promotion-requests/${id}/reject`, {
    reason,
  });
  return response.data.data;
};

export const updatePromotionStatus = async (
  id: string,
  payload: { isActive?: boolean; order?: number }
): Promise<PromotionRequest> => {
  const response = await api.patch(`/admin/promotion-requests/${id}/status`, payload);
  return response.data.data;
};
