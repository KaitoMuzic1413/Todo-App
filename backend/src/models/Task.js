import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ["active", "complete"],
        default: "active"
    },
    completedAt: {
        type: Date,
        default: null
    },
    isDeleted: { 
        type: Boolean, default: false 
    },
    deletedAt: { 
        type: Date, default: null 
    }
},
{
    timestamps: true,
});

taskSchema.index({ deletedAt: 1 });

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);
export default Task;