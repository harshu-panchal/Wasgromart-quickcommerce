import { Router } from "express";
import { handleRazorpayWebhook } from "./razorpayWebhookController";

const router = Router();

// Dedicated webhook endpoint:
// POST /api/webhooks/razorpay
router.post("/", handleRazorpayWebhook);

export default router;

