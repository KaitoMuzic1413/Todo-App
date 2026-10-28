import cors from 'cors';
import express from 'express';
import { allowedOrigins, env, isAllowedOrigin } from './config/env.js';
import { connectDB } from './config/db.js';
import { cleanupExpiredTrashTasks } from './controllers/tasksControllers.js';
import { cleanupInactiveUsers } from './controllers/usersControllers.js';
import { cleanupExpiredTrashAttachments } from './controllers/attachmentsControllers.js';
import authRoute from './routes/authRoutes.js';
import taskRoute from './routes/tasksRouters.js';
import userRoute from './routes/usersRoutes.js';
import attachmentRoute from './routes/attachmentsRoutes.js';
import focusRoute from './routes/focusRoutes.js';
import analyticsRoute from './routes/analyticsRoutes.js';
import gamificationRoute from './routes/gamificationRoutes.js';
import calendarNotesRoute from './routes/calendarNotesRoutes.js';
import notificationsRoute from './routes/notificationsRoutes.js';
import premiumRoute from './routes/premiumRoutes.js';
import pushRoute from './routes/pushRoutes.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { requireTrustedOrigin, securityHeaders } from './middleware/requestGuards.js';
import { runDueTaskEmailReminders } from './utils/dueTaskReminders.js';
import { runDueTaskNotifications } from './utils/dueTaskNotifications.js';

const PORT = env.port;
const INACTIVE_ACCOUNT_CHECK_INTERVAL = 60 * 60 * 1000;

const app = express();

const hasWildcardOrigin = env.extraCorsOrigins.includes('*')
  || process.env.CORS_ALLOW_ALL === 'true';

const originMatchesPattern = (origin, pattern) => {
  if (!pattern.includes('*')) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(origin);
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (hasWildcardOrigin || allowedOrigins.has(origin) || isAllowedOrigin(origin)) return true;
  return env.extraCorsOrigins.some((pattern) => originMatchesPattern(origin, pattern));
};

const corsOptions = {
  origin(origin, callback) {
    // Native clients and same-origin requests may not send an Origin header.
    return callback(null, isOriginAllowed(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
  exposedHeaders: ['X-Auth-Token'],
};

app.use(securityHeaders);
app.use(cors(corsOptions));
// Answer preflights before the database or any authentication work runs.
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ error: 'Database connection error' });
  }
});

app.get('/', (req, res) => {
  res.status(200).json({ message: 'API Server is running...' });
});

app.use('/api/auth', requireTrustedOrigin, authRoute);
app.use('/api', requireTrustedOrigin, apiRateLimiter);
app.use('/api/users', userRoute);
app.use('/api/tasks', taskRoute);
app.use('/api/attachments', attachmentRoute);
app.use('/api/focus', focusRoute);
app.use('/api/analytics', analyticsRoute);
app.use('/api/gamification', gamificationRoute);
app.use('/api/calendar-notes', calendarNotesRoute);
app.use('/api/notifications', notificationsRoute);
app.use('/api/premium', premiumRoute);
app.use('/api/push', pushRoute);

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
    console.error('[Maintenance Error]:', error);
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
