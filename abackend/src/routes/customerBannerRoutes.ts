import { Router } from "express";
import { getActiveBanners } from "../modules/customer/controllers/customerBannerController";

const router = Router();

// Public route - no authentication required
router.get("/", getActiveBanners);

export default router;
