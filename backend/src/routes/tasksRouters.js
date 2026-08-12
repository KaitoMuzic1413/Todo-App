import express from "express";
import {
  clearTrash,
  createTask,
  deletePermanentTask,
  deleteTask,
  getAllTasks,
  getTrashTasks,
  restoreTask,
  toggleTaskStatus,
  updateTask,
  getUserQuota,
} from "../controllers/tasksControllers.js";

const router = express.Router();

router.get("/", getAllTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.patch("/:id/toggle", toggleTaskStatus);
router.get("/trash/all", getTrashTasks);
router.delete("/trash/clear", clearTrash);
router.patch("/:id/restore", restoreTask);
router.delete("/:id/permanent", deletePermanentTask);
router.delete("/:id", deleteTask);

// user quota
router.get("/quota/:userId", getUserQuota);

export default router;