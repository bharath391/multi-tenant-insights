import { type Router as RouterType, Router } from "express";
import { TenantDataSync } from "../controllers/datasync.controller.js"
const router: RouterType = Router();


router.post('/:tenantId', TenantDataSync);


export default router;