import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { cleanupExpiredTrashTasks } from "./controllers/tasksControllers.js";
import { cleanupInactiveUsers } from "./controllers/usersControllers.js";
import authRoute from "./routes/authRoutes.js";
import taskRoute from "./routes/tasksRouters.js";
import userRoute from "./routes/usersRoutes.js";

const PORT = process.env.PORT || 5001;
const INACTIVE_ACCOUNT_CHECK_INTERVAL = 60 * 60 * 1000;

const app = express();

const corsOptions = {
  origin: true,
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).json({ error: "Database connection error" });
  }
});

// 1. Root route kiểm tra Server
app.get("/", (req, res) => {
  res.status(200).json({ message: "API Server is running..." });
});

// 2. Routes chính
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/tasks", taskRoute);

// 3. Middleware bắt tất cả route không tồn tại (404 Handler)
app.use((req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
});

const runMaintenanceJobs = async () => {
  try {
    const { deletedUsers, deletedTasks } = await cleanupInactiveUsers();
    const expiredTrashTasks = await cleanupExpiredTrashTasks();

    if (deletedUsers > 0 || deletedTasks > 0 || expiredTrashTasks > 0) {
      console.log(
        `[Maintenance] Cleaned: ${deletedUsers} inactive users, ${deletedTasks} tasks, ${expiredTrashTasks} expired trash tasks.`
      );
    }
  } catch (error) {
    console.error("[Maintenance Error]:", error);
  }
};

// Kiểm tra nếu không phải môi trường Serverless (Vercel) thì khởi chạy app.listen
if (!process.env.VERCEL) {
  const startMaintenanceJobs = () => {
    runMaintenanceJobs();
    setInterval(runMaintenanceJobs, INACTIVE_ACCOUNT_CHECK_INTERVAL);
  };

  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    startMaintenanceJobs();
  });
}

// Export app để Vercel Serverless Function có thể sử dụng
export default app;