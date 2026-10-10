import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getGamificationSummary } from '../controllers/gamificationControllers.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', getGamificationSummary);

export default router;