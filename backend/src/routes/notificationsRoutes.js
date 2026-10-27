import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import requireAdmin from '../middleware/requireAdmin.js';
import {
  createNotification,
  archiveAdminNotification,
  cloneAdminNotification,
  resendAdminNotification,
  translateNotificationTexts,
  deleteAdminNotification,
  getNotification,
  getUnreadNotificationCount,
  listAdminNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationsController.js';

const router = express.Router();
router.use(verifyToken);

router.post('/translate', translateNotificationTexts);
router.get('/', listNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.get('/admin', requireAdmin, listAdminNotifications);
router.post('/admin', requireAdmin, createNotification);
router.post('/admin/:id/clone', requireAdmin, cloneAdminNotification);
router.post('/admin/:id/resend', requireAdmin, resendAdminNotification);
router.patch('/admin/:id/archive', requireAdmin, archiveAdminNotification);
router.delete('/admin/:id', requireAdmin, deleteAdminNotification);
router.patch('/read-all', markAllNotificationsRead);
router.get('/:id', getNotification);
router.patch('/:id/read', markNotificationRead);

export default router;
