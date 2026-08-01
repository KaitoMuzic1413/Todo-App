import express from 'express';
import mongoose from 'mongoose';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

import tasksRouters from './routes/tasksRouters.js';
import Task from './models/Task.js';

const app = express();

app.use(express.json());

app.use('/api/tasks', tasksRouters);

app.get('/', (req, res) => {
  res.send('Kaito Todo App Backend is running successfully!');
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_CONNECTIONSTRING;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully');

    cron.schedule('0 0 * * *', async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await Task.deleteMany({
          isDeleted: true,
          deletedAt: { $lt: thirtyDaysAgo }
        });
        
        console.log(`[Cron Job] Deleted ${result.deletedCount} task pass 30 days.`);
      } catch (error) {
        console.error('[Cron Job Error]:', error);
      }
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err);
  });