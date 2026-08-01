import Task from '../models/Task.js';

export const getAllTasks = async (req, res) => {
    try {
        const tasks = await Task.find().sort({createdAt: -1});
        res.status(200).json(tasks);
    } catch (error) {
        console.error("error getAllTask", error);
        res.status(500).json({ message: "server error" });
    }
};

export const createTask = async (req, res) => {
    try {
        const { title } = req.body;
        
        const task = new Task({title});

        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (error) {
        console.error("error createTask", error);
        res.status(500).json({ message: "server error" });
    }
};

export const updateTask = async (req, res) => {
    try {
        const {title, status, completedAt} = req.body;
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            {
                title,
                status,
                completedAt
            },
            {new: true}
        );

        if (!updatedTask) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json(updatedTask);
    } catch (error) {
        console.error("error updateTask", error);
        res.status(500).json({ message: "server error" });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.id);

        if (!deletedTask) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json(deleteTask);
    } catch (error) {
        console.error("error deleteTask", error);
        res.status(500).json({ message: "server error" });
    }
};

const Task = require('../models/Task');

exports.softDeleteTask = async (req, res) => {
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

exports.getTrashTasks = async (req, res) => {
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

exports.restoreTask = async (req, res) => {
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

exports.permanentDeleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ message: 'Task permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};