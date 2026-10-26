import express from "express";
import { getAuthenticatedCurrentUser, getCurrentUser, getUserPreferences, updateCurrentUserAvatar, updateCurrentUserName, updateUserPreferences } from "../controllers/usersControllers.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", verifyToken, getCurrentUser);
router.get('/current', verifyToken, getAuthenticatedCurrentUser);
router.get('/preferences', verifyToken, getUserPreferences);
router.patch('/preferences', verifyToken, updateUserPreferences);
router.patch('/profile', verifyToken, updateCurrentUserName);
router.patch('/profile/avatar', verifyToken, updateCurrentUserAvatar);

export default router;
