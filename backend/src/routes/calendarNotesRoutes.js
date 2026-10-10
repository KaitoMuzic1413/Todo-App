import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getCalendarNotes, saveCalendarNote } from '../controllers/calendarNotesController.js';

const router = express.Router();
router.use(verifyToken);
router.get('/', getCalendarNotes);
router.put('/:dateKey', saveCalendarNote);

export default router;
