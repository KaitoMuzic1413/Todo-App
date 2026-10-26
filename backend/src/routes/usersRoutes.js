import express from "express";
import { exportCurrentUserData, getAuthenticatedCurrentUser, getCurrentUser, getUserPreferences, updateCurrentUserName, updateUserPreferences } from "../controllers/usersControllers.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", getCurrentUser);
router.get('/current', verifyToken, getAuthenticatedCurrentUser);
router.get('/export', verifyToken, exportCurrentUserData);
router.get('/preferences', verifyToken, getUserPreferences);
router.patch('/preferences', verifyToken, updateUserPreferences);
router.patch('/profile', verifyToken, updateCurrentUserName);

export default router;
