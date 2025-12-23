import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

//router.get('/', authenticateToken, getInsights);

export default router;
