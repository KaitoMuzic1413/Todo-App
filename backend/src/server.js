import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { cleanupInactiveUsers } from "./controllers/usersControllers.js";
import { cleanupExpiredTrashTasks } from "./controllers/tasksControllers.js";
import { connectDB } from "./config/db.js";
import taskRoute from "./routes/tasksRouters.js";
import userRoute from "./routes/usersRoutes.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const INACTIVE_ACCOUNT_CHECK_INTERVAL = 60 * 60 * 1000;

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/users", userRoute);
app.use("/api/tasks", taskRoute);

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