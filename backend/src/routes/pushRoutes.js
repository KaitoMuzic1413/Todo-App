import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getPushConfig, subscribeToPush, unsubscribeFromPush } from '../controllers/pushControllers.js';

const router = express.Router();

router.get('/public-key', getPushConfig);

router.use(verifyToken);
router.post('/subscribe', subscribeToPush);
router.delete('/subscribe', unsubscribeFromPush);

export default router;
