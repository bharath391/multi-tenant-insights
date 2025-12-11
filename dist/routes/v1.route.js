import { Router } from "express";
import express from "express";
import authRouter from "./auth.route.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
// import datasyncRouter from "./datasync.route.js";
// import insightsRouter from "./insights.route.js";
// import shopifyWebhookRouter from "./shopify.webhook.route.js";
// import tenantRouter from "./tenants.route.js";
const app = express();
// v1 route
app.use("/auth", authRouter);
app.get("/", (req, res) => {
    res.status(200).json({ msg: "yes bruh" });
    return;
});
// Middleware applied to protected routes (uncomment when ready)
// app.use("/sync", authenticateToken, datasyncRouter);
// app.use("/insights", authenticateToken, insightsRouter);
// app.use("/tenants", authenticateToken, tenantRouter);
// Webhooks often need raw bodies or specific handling, but if you want auth:
// app.use("/webhooks", authenticateToken, shopifyWebhookRouter);
export default app;
//# sourceMappingURL=v1.route.js.map