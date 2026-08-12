import express from 'express';
import { createInviteCode, redeemInviteCode, getInviteCodesForAdmin } from '../controllers/premiumControllers.js';

const router = express.Router();

router.post('/invite/create', createInviteCode);
router.post('/invite/redeem', redeemInviteCode);
router.get('/invite/list', getInviteCodesForAdmin);

export default router;
