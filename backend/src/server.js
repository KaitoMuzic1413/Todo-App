import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { connectDB } from "./config/db.js";
import { cleanupExpiredTrashTasks } from "./controllers/tasksControllers.js";
import { cleanupInactiveUsers } from "./controllers/usersControllers.js";
import authRoute from "./routes/authRoutes.js";
import taskRoute from "./routes/tasksRouters.js";
import userRoute from "./routes/usersRoutes.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const INACTIVE_ACCOUNT_CHECK_INTERVAL = 60 * 60 * 1000;

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://todo-app-seven-mocha-91.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      origin.endsWith(".onrender.com")
    ) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: ${origin} is not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/tasks", taskRoute);

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

connectDB()
  .then(() => {
    startMaintenanceJobs();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });