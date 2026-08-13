import express from 'express';
import { 
  createInviteCode, 
  redeemInviteCode, 
  getInviteCodesForAdmin, 
  deleteInviteCode // <-- 1. Thêm hàm này vào đây
} from '../controllers/premiumControllers.js';

const router = express.Router();

router.post('/invite/create', createInviteCode);
router.post('/invite/redeem', redeemInviteCode);
router.get('/invite/list', getInviteCodesForAdmin);

// 2. Thêm dòng route delete này xuống dưới cùng:
router.delete('/invite/delete', deleteInviteCode);

export default router;