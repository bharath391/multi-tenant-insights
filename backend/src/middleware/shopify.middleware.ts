import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../utils/env.js";

const authenticateShopify = (req: Request, res: Response, next: NextFunction) => {
    const shopifyHmac = req.get("X-Shopify-Hmac-Sha256");
    if (!shopifyHmac) {
        return res.status(401).json({ msg: "Unauthorized: Missing Shopify HMAC header." });
    }

    // It's important to use the raw body to create the hash,
    // as parsing it will change its structure and result in a different hash.
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
        return res.status(500).json({ msg: "Internal Server Error: Raw body not available for HMAC validation." });
    }

    const generatedHash = crypto
        .createHmac("sha256", env("SHOPIFY_WEBHOOK_SECRET"))
        .update(rawBody, "utf8")
        .digest("base64");

    const trusted = Buffer.from(shopifyHmac, 'base64');
    const computed = Buffer.from(generatedHash, 'base64');

    if (crypto.timingSafeEqual(trusted, computed)) {
        next();
    } else {
        res.status(401).json({ msg: "Unauthorized: Invalid Shopify HMAC." });
    }
};

export default authenticateShopify;
