import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path"; // 1. Import thêm path để xử lý đường dẫn thư mục
import { cleanupInactiveUsers } from "./controllers/usersControllers.js";
import { cleanupExpiredTrashTasks } from "./controllers/tasksControllers.js";
import { connectDB } from "./config/db.js";
import taskRoute from "./routes/tasksRouters.js";
import userRoute from "./routes/usersRoutes.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const INACTIVE_ACCOUNT_CHECK_INTERVAL = 60 * 60 * 1000;

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/users", userRoute);
app.use("/api/tasks", taskRoute);

// 2. Thêm đoạn cấu hình phục vụ Frontend (cho môi trường Production trên Render)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

const runMaintenanceJobs = async () => {
  try {
    const { deletedUsers, deletedTasks } = await cleanupInactiveUsers();
    const expiredTrashTasks = await cleanupExpiredTrashTasks();

    if (deletedUsers > 0 || deletedTasks > 0 || expiredTrashTasks > 0) {
      console.log(
        `Maintenance complete: ${deletedUsers} inactive users removed, ${deletedTasks} tasks removed, ${expiredTrashTasks} expired trash tasks deleted.`
      );
    }
  } catch (error) {
    console.error("Error during maintenance cleanup:", error);
  }
};

const startMaintenanceJobs = () => {
  runMaintenanceJobs();

  setInterval(() => {
    runMaintenanceJobs();
  }, INACTIVE_ACCOUNT_CHECK_INTERVAL);
};

connectDB().then(() => {
  startMaintenanceJobs();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});