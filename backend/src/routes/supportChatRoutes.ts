import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  getConversations,
  getConversationMessages,
  markRead,
  sendMessage,
} from "../modules/chat/controllers/supportChatController";

const router = Router();

router.use(authenticate);

// Admin-only list
router.get("/conversations", requireUserType("Admin"), getConversations);

// Shared endpoints (Admin/Seller)
router.get(
  "/conversations/:sellerId/messages",
  requireUserType("Admin", "Seller"),
  getConversationMessages
);
router.post(
  "/messages",
  requireUserType("Admin", "Seller"),
  sendMessage
);
router.post(
  "/conversations/:sellerId/read",
  requireUserType("Admin", "Seller"),
  markRead
);

export default router;
