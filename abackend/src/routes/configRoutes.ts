import { Router } from "express";
import { getPublicConfig } from "../controllers/configController";

const router = Router();

// GET /api/v1/config/public - Public configuration endpoint
router.get("/public", getPublicConfig);

export default router;
