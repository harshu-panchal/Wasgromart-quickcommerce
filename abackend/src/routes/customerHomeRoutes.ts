import { Router } from "express";
import {
  getHomeContent,
  getHomeSections,
  getHomeSectionProducts,
  getStoreProducts,
} from "../modules/customer/controllers/customerHomeController";

const router = Router();

// Public routes
router.get("/", getHomeContent);
// Paginated home sections (chunked loading on scroll)
router.get("/sections", getHomeSections);
// Paginated products inside a single home section (chunked "See More")
router.get("/sections/:sectionId/products", getHomeSectionProducts);
router.get("/store/:storeId", getStoreProducts);

export default router;
