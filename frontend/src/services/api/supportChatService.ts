import api from "./config";

export interface SupportConversationApi {
  _id: string;
  seller: {
    _id: string;
    sellerName?: string;
    storeName?: string;
    email?: string;
    mobile?: string;
  };
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageBy?: "Seller" | "Admin";
  unreadForAdmin: number;
  unreadForSeller: number;
  isOpen: boolean;
}

export interface SupportMessageApi {
  _id: string;
  conversation: string;
  senderType: "Seller" | "Admin";
  senderId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export const fetchSupportConversations = async () => {
  const response = await api.get("/support/conversations");
  return response.data?.data as SupportConversationApi[];
};

export const fetchSupportMessages = async (sellerId: string, limit = 50) => {
  const response = await api.get(`/support/conversations/${sellerId}/messages`, {
    params: { limit },
  });
  return response.data?.data as {
    conversation: SupportConversationApi | null;
    messages: SupportMessageApi[];
  };
};

export const sendSupportMessage = async (payload: {
  sellerId?: string;
  text: string;
}) => {
  const response = await api.post("/support/messages", payload);
  return response.data?.data as {
    conversation: SupportConversationApi;
    message: SupportMessageApi;
  };
};

export const markSupportConversationRead = async (sellerId: string) => {
  const response = await api.post(`/support/conversations/${sellerId}/read`);
  return response.data;
};
