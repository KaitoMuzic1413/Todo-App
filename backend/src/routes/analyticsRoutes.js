import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getProductivityAnalytics } from '../controllers/analyticsControllers.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', getProductivityAnalytics);

export default router;