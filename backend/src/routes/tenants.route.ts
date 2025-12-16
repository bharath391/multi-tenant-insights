import {Router} from "express";
import {getAllTenants,addTenant} from "../controllers/tenant.controller.js";

const router = Router();


router.get('/',getAllTenants);
router.post('/new',addTenant);


export default router;