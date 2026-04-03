import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import {
  createSupportMessage,
  getSupportMessages,
  listSupportConversations,
  markConversationRead,
  deleteSupportConversation,
} from "../services/supportChatService";
import { Server as SocketIOServer } from "socket.io";

const emitSupportMessage = (
  io: SocketIOServer | undefined,
  payload: {
    sellerId: string;
    message: any;
    conversation: any;
  }
) => {
  if (!io) return;

  const { sellerId, message, conversation } = payload;
  const messagePayload = {
    id: message._id,
    conversationId: conversation?._id,
    sellerId,
    senderType: message.senderType,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };

  const conversationPayload = {
    id: conversation?._id,
    sellerId,
    lastMessage: conversation?.lastMessage || message.text,
    lastMessageAt: conversation?.lastMessageAt || message.createdAt,
    lastMessageBy: conversation?.lastMessageBy || message.senderType,
    unreadForAdmin: conversation?.unreadForAdmin ?? 0,
    unreadForSeller: conversation?.unreadForSeller ?? 0,
    isOpen: conversation?.isOpen ?? true,
  };

  io.to("support-admin").emit("support:conversation-update", conversationPayload);
  io.to(`support-seller-${sellerId}`).emit(
    "support:conversation-update",
    conversationPayload
  );
  io.to("support-admin").emit("support:message", messagePayload);
  io.to(`support-seller-${sellerId}`).emit("support:message", messagePayload);
};

const emitConversationUpdate = (
  io: SocketIOServer | undefined,
  payload: {
    sellerId: string;
    conversation: any;
  }
) => {
  if (!io) return;

  const { sellerId, conversation } = payload;
  const conversationPayload = {
    id: conversation?._id,
    sellerId,
    lastMessage: conversation?.lastMessage,
    lastMessageAt: conversation?.lastMessageAt,
    lastMessageBy: conversation?.lastMessageBy,
    unreadForAdmin: conversation?.unreadForAdmin ?? 0,
    unreadForSeller: conversation?.unreadForSeller ?? 0,
    isOpen: conversation?.isOpen ?? true,
  };

  io.to("support-admin").emit("support:conversation-update", conversationPayload);
  io.to(`support-seller-${sellerId}`).emit(
    "support:conversation-update",
    conversationPayload
  );
};

const emitConversationDeleted = (
  io: SocketIOServer | undefined,
  payload: {
    sellerId: string;
  }
) => {
  if (!io) return;
  const { sellerId } = payload;
  io.to("support-admin").emit("support:conversation-deleted", { sellerId });
  io.to(`support-seller-${sellerId}`).emit("support:conversation-deleted", {
    sellerId,
  });
};

export const getConversations = asyncHandler(
  async (_req: Request, res: Response) => {
    const conversations = await listSupportConversations();

    res.status(200).json({
      success: true,
      message: "Support conversations fetched successfully",
      data: conversations,
    });
  }
);

export const getConversationMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const { sellerId } = req.params;
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const user = req.user;

    if (user?.userType === "Seller" && user.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { conversation, messages } = await getSupportMessages(sellerId, limit);
    let updatedConversation = conversation;

    if (conversation) {
      const userType = req.user?.userType;
      if (userType === "Admin" || userType === "Seller") {
        updatedConversation = await markConversationRead(sellerId, userType);
        const io = req.app.get("io") as SocketIOServer | undefined;
        if (updatedConversation) {
          emitConversationUpdate(io, {
            sellerId,
            conversation: updatedConversation,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Support messages fetched successfully",
      data: {
        conversation: updatedConversation,
        messages,
      },
    });
  }
);

export const sendMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user;
    const { text } = req.body;
    const sellerId =
      user?.userType === "Seller" ? user.userId : req.body.sellerId;

    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "Seller id is required",
      });
    }

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        message: "Message text is required",
      });
    }

    const senderType = user?.userType === "Seller" ? "Seller" : "Admin";
    const senderId = user?.userId;

    if (!senderId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { conversation, message } = await createSupportMessage({
      sellerId,
      senderType,
      senderId,
      text,
    });

    const io = req.app.get("io") as SocketIOServer | undefined;
    emitSupportMessage(io, { sellerId, conversation, message });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: {
        conversation,
        message,
      },
    });
  }
);

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const { sellerId } = req.params;

  if (!sellerId) {
    return res.status(400).json({
      success: false,
      message: "Seller id is required",
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (user.userType === "Seller" && user.userId !== sellerId) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  if (user.userType === "Admin" || user.userType === "Seller") {
    const conversation = await markConversationRead(sellerId, user.userType);
    const io = req.app.get("io") as SocketIOServer | undefined;
    if (conversation) {
      emitConversationUpdate(io, { sellerId, conversation });
    }
  }

  res.status(200).json({
    success: true,
    message: "Conversation marked as read",
  });
});

export const deleteConversation = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user;
    const { sellerId } = req.params;

    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "Seller id is required",
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (user.userType === "Seller" && user.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await deleteSupportConversation(sellerId);

    const io = req.app.get("io") as SocketIOServer | undefined;
    emitConversationDeleted(io, { sellerId });

    res.status(200).json({
      success: true,
      message: "Conversation deleted",
    });
  }
);
