import {Router} from "express";
import { TenantDataSync, testShopifyConnection } from "../controllers/datasync.controller.js"
const router = Router();


router.get('/shopify/test/:tenantId', testShopifyConnection);
router.post('/:tenantId', TenantDataSync);


export default router;