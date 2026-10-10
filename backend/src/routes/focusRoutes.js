import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import {
  getActiveFocusSession,
  getFocusSummary,
  startFocusSession,
  updateFocusSession,
} from '../controllers/focusControllers.js';

const router = express.Router();

router.use(verifyToken);
router.get('/active', getActiveFocusSession);
router.get('/summary', getFocusSummary);
router.post('/', startFocusSession);
router.patch('/:id/:action', updateFocusSession);

export default router;