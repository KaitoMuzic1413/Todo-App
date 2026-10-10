import express from "express";
import { getCurrentUser, getUserPreferences, updateCurrentUserName, updateUserPreferences } from "../controllers/usersControllers.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", getCurrentUser);
router.get('/preferences', verifyToken, getUserPreferences);
router.patch('/preferences', verifyToken, updateUserPreferences);
router.patch('/profile', verifyToken, updateCurrentUserName);

export default router;
