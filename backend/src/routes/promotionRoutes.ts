import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  createPromotionRequest,
  getMyPromotions,
} from "../modules/seller/controllers/sellerPromotionController";

const router = Router();

router.use(authenticate);

// Seller submits new promotion request
router.post("/", requireUserType("Seller"), createPromotionRequest);

// Seller gets their requests
router.get("/mine", requireUserType("Seller"), getMyPromotions);

export default router;
