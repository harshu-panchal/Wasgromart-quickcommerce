import mongoose from "mongoose";
import Seller from "../../../models/Seller";
import SupportConversation, {
  ISupportConversation,
  SupportSenderType,
} from "../../../models/SupportConversation";
import SupportMessage, {
  ISupportMessage,
} from "../../../models/SupportMessage";

export interface SupportMessagePayload {
  sellerId: string;
  senderType: SupportSenderType;
  senderId: string;
  text: string;
}

export const ensureSupportConversation = async (
  sellerId: string
): Promise<ISupportConversation> => {
  const seller = await Seller.findById(sellerId).select("_id");
  if (!seller) {
    const error: any = new Error("Seller not found");
    error.statusCode = 404;
    throw error;
  }

  const conversation = await SupportConversation.findOneAndUpdate(
    { seller: sellerId },
    {
      $setOnInsert: {
        seller: sellerId,
        unreadForAdmin: 0,
        unreadForSeller: 0,
        isOpen: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return conversation;
};

export const createSupportMessage = async (
  payload: SupportMessagePayload
): Promise<{
  conversation: ISupportConversation;
  message: ISupportMessage;
}> => {
  const { sellerId, senderType, senderId, text } = payload;
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Message text is required");
  }

  const conversation = await ensureSupportConversation(sellerId);

  const message = await SupportMessage.create({
    conversation: conversation._id,
    senderType,
    senderId: new mongoose.Types.ObjectId(senderId),
    text: trimmedText,
  });

  const update = {
    $set: {
      lastMessage: trimmedText,
      lastMessageAt: message.createdAt,
      lastMessageBy: senderType,
    },
    $inc:
      senderType === "Seller"
        ? { unreadForAdmin: 1 }
        : { unreadForSeller: 1 },
  };

  await SupportConversation.updateOne({ _id: conversation._id }, update);

  const refreshedConversation = await SupportConversation.findById(
    conversation._id
  );

  return {
    conversation: refreshedConversation || conversation,
    message,
  };
};

export const listSupportConversations = async () => {
  const conversations = await SupportConversation.find()
    .populate("seller", "sellerName storeName email mobile")
    .sort({ lastMessageAt: -1, updatedAt: -1 });

  return conversations;
};

export const getSupportMessages = async (
  sellerId: string,
  limit = 50
) => {
  const conversation = await SupportConversation.findOne({ seller: sellerId });
  if (!conversation) {
    return { conversation: null, messages: [] };
  }

  const messages = await SupportMessage.find({
    conversation: conversation._id,
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(limit, 200)));

  return { conversation, messages };
};

export const markConversationRead = async (
  sellerId: string,
  userType: "Admin" | "Seller"
) => {
  const update =
    userType === "Admin"
      ? { $set: { unreadForAdmin: 0 } }
      : { $set: { unreadForSeller: 0 } };

  const conversation = await SupportConversation.findOneAndUpdate(
    { seller: sellerId },
    update,
    { new: true }
  );

  return conversation;
};
