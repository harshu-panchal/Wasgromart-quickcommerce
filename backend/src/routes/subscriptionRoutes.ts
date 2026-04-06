import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import * as subscriptionController from "../modules/subscription/controllers/subscriptionController";

const router = Router();

router.use(authenticate);
router.use(requireUserType("Seller"));

router.post("/create", subscriptionController.createSubscription);
router.post("/cancel", subscriptionController.cancelSubscription);
router.get("/:id", subscriptionController.getSubscription);

export default router;

