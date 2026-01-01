import { Router } from "express";
import express from "express";
import authRouter from "./auth.route.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import datasyncRouter from "./datasync.route.js";
import insightsRouter from "./insights.route.js";
import shopifyWebhookRouter from "./shopify.webhook.route.js";
import tenantRouter from "./tenants.route.js";

const router = Router();
// v1 route

router.get("/", (req, res) => {
    res.status(200).json({ msg: "In v1 Route" });
    return;
});

router.use("/auth", authRouter);
router.use("/tenants", authenticateToken, tenantRouter);
router.use("/sync", authenticateToken, datasyncRouter);
//router.use("/insights", authenticateToken, insightsRouter);

router.use("/shopify-webhooks", shopifyWebhookRouter);

export default router;

