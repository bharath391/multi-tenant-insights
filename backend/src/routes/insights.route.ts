import {Router} from "express";
import {combinedInsights,TenantOrders,topCustomers} from "../controllers/insights.controller.js";

const router = Router();


router.get('/totals',combinedInsights);
router.post('/orders-by-date',TenantOrders);
router.post('/top-customers',topCustomers);


export default router;