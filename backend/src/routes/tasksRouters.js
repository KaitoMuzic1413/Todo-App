import express from 'express';
import mongoose from 'mongoose';
import cron from 'node-cron';

const router = express.Router();

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  completed: { type: Boolean, default: false },
  
  // Các trường cho tính năng Thùng rác
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

taskSchema.index({ deletedAt: 1 });
const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

const softDeleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ message: 'Task moved to trash', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTrashTasks = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const deletedTasks = await Task.find({
      isDeleted: true,
      deletedAt: { $gte: thirtyDaysAgo }
    }).sort({ deletedAt: -1 });

    const trashBins = {
      today: [],
      thisWeek: [],
      thisMonth: []
    };

    deletedTasks.forEach(task => {
      const deletedDate = new Date(task.deletedAt);
      if (deletedDate >= startOfToday) {
        trashBins.today.push(task);
      } else if (deletedDate >= startOfWeek) {
        trashBins.thisWeek.push(task);
      } else if (deletedDate >= startOfMonth) {
        trashBins.thisMonth.push(task);
      }
    });

    res.status(200).json(trashBins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const restoreTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false, deletedAt: null },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ message: 'Task restored successfully', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const permanentDeleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ message: 'Task permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

router.get('/trash', getTrashTasks);
router.put('/:id/soft-delete', softDeleteTask);
router.put('/:id/restore', restoreTask);
router.delete('/:id/permanent', permanentDeleteTask);

cron.schedule('0 0 * * *', async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Task.deleteMany({
      isDeleted: true,
      deletedAt: { $lt: thirtyDaysAgo }
    });
    
    console.log(`[Cron Job] Đã dọn dẹp ${result.deletedCount} task quá hạn 30 ngày.`);
  } catch (error) {
    console.error('[Cron Job Error]:', error);
  }
});

export default router;