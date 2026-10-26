import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { cleanupExpiredTrashTasks } from "./controllers/tasksControllers.js";
import { cleanupInactiveUsers } from "./controllers/usersControllers.js";
import authRoute from "./routes/authRoutes.js";
import taskRoute from "./routes/tasksRouters.js";
import userRoute from "./routes/usersRoutes.js";
import attachmentRoute from "./routes/attachmentsRoutes.js";
import { cleanupExpiredTrashAttachments } from "./controllers/attachmentsControllers.js";
import focusRoute from "./routes/focusRoutes.js";
import analyticsRoute from './routes/analyticsRoutes.js';
import gamificationRoute from './routes/gamificationRoutes.js';
import calendarNotesRoute from './routes/calendarNotesRoutes.js';
import notificationsRoute from './routes/notificationsRoutes.js';
import { runDueTaskEmailReminders } from './utils/dueTaskReminders.js';
import { runDueTaskNotifications } from './utils/dueTaskNotifications.js';

const PORT = process.env.PORT || 5001;
const INACTIVE_ACCOUNT_CHECK_INTERVAL = 60 * 60 * 1000;

const app = express();

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

const corsOptions = {
  origin(origin, callback) {
    // Native clients and same-origin requests may not send an Origin header.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Idempotency-Key"],
  exposedHeaders: ["X-Auth-Token"],
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

app.get("/", (req, res) => {
  res.status(200).json({ message: "API Server is running..." });
});

app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/tasks", taskRoute);
app.use("/api/attachments", attachmentRoute);
app.use('/api/focus', focusRoute);
app.use('/api/analytics', analyticsRoute);
app.use('/api/gamification', gamificationRoute);
app.use('/api/calendar-notes', calendarNotesRoute);
app.use('/api/notifications', notificationsRoute);

app.use((req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'Server error.' });
});

const runMaintenanceJobs = async () => {
  try {
    const { deletedUsers, deletedTasks } = await cleanupInactiveUsers();
    const expiredTrashTasks = await cleanupExpiredTrashTasks();
    const expiredTrashAttachments = await cleanupExpiredTrashAttachments();

    if (deletedUsers > 0 || deletedTasks > 0 || expiredTrashTasks > 0 || expiredTrashAttachments > 0) {
      console.log(
        `[Maintenance] Cleaned: ${deletedUsers} inactive users, ${deletedTasks} tasks, ${expiredTrashTasks} expired trash tasks, ${expiredTrashAttachments} expired trash attachments.`
      );
    }
  } catch (error) {
    console.error("[Maintenance Error]:", error);
  }
};

if (!process.env.VERCEL) {
  const startMaintenanceJobs = () => {
    runMaintenanceJobs();
    setInterval(runMaintenanceJobs, INACTIVE_ACCOUNT_CHECK_INTERVAL);
    runDueTaskEmailReminders();
    setInterval(runDueTaskEmailReminders, 60 * 1000);
    runDueTaskNotifications();
    setInterval(runDueTaskNotifications, 60 * 1000);
  };

  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await connectDB();
    startMaintenanceJobs();
  });
}

export default app;
