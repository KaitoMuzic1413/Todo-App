import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { connectDB } from "./config/db.js";
import { cleanupExpiredTrashTasks } from "./controllers/tasksControllers.js";
import { cleanupInactiveUsers } from "./controllers/usersControllers.js";
import taskRoute from "./routes/tasksRouters.js";
import userRoute from "./routes/usersRoutes.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const INACTIVE_ACCOUNT_CHECK_INTERVAL = 60 * 60 * 1000;

const app = express();

// Danh sách các tên miền được phép truy cập API
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://todo-app-seven-mocha-91.vercel.app",
];

// Cấu hình Middleware CORS cho Express
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Routes API
app.use("/api/users", userRoute);
app.use("/api/tasks", taskRoute);

// Phục vụ Static File
const __dirname = path.resolve();
const distPath = path.join(__dirname, "../frontend/dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("API Server is running...");
  });
}

// Xử lý các công việc bảo trì định kỳ
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

const startMaintenanceJobs = () => {
  runMaintenanceJobs();
  setInterval(runMaintenanceJobs, INACTIVE_ACCOUNT_CHECK_INTERVAL);
};

// Kết nối Database & Khởi chạy Server
connectDB()
  .then(() => {
    startMaintenanceJobs();

    // Chạy Express trực tiếp
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });