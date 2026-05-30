import { Router } from "express";
import * as deliveryAuthController from "../modules/delivery/controllers/deliveryAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";
import { uploadDocument, handleUploadError } from "../middleware/upload";

const router = Router();

// Send SMS OTP route
router.post("/send-sms-otp", otpRateLimiter, deliveryAuthController.sendSmsOtp);

// Verify SMS OTP and login route
router.post("/verify-sms-otp", loginRateLimiter, deliveryAuthController.verifySmsOtp);

// Public pre-registration document upload for delivery signup
router.post(
  "/signup-document",
  otpRateLimiter,
  uploadDocument.single("document"),
  handleUploadError,
  deliveryAuthController.uploadSignupDocument
);

// Register route
router.post("/register", deliveryAuthController.register);

export default router;
