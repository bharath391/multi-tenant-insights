import {Router} from "express";
import syncWebhookData from "../controllers/webhook.controller.js";
import authenticateShopify from "../middleware/shopify.middleware.js";
const router = Router();

router.post("/webhook", authenticateShopify, syncWebhookData);

export default router;