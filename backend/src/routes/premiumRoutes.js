import express from 'express';
import {
  createInviteCode,
  deleteInviteCode,
  getInviteCodesForAdmin,
  getMyPremium,
  redeemInviteCode,
  requirePremiumAdmin,
} from '../controllers/premiumControllers.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/me', getMyPremium);

router.post('/redeem', redeemInviteCode);
router.post('/invite/redeem', redeemInviteCode);

router.post('/invite/create', requirePremiumAdmin, createInviteCode);
router.get('/invite/list', requirePremiumAdmin, getInviteCodesForAdmin);
router.get('/invites', requirePremiumAdmin, getInviteCodesForAdmin);
router.delete('/invite/delete', requirePremiumAdmin, deleteInviteCode);
router.delete('/invite/:id', requirePremiumAdmin, deleteInviteCode);

export default router;
