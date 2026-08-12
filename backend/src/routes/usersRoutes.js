import express from "express";
import { getCurrentUser, loginUserWithEmail } from "../controllers/usersControllers.js";

const router = express.Router();

router.post("/login", loginUserWithEmail);
router.get("/me", getCurrentUser);

export default router;
