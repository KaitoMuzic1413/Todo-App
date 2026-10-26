import mongoose from "mongoose";

export const connectDB = async () => {
    if (!process.env.MONGODB_CONNECTIONSTRING) {
        throw new Error("MONGODB_CONNECTIONSTRING is required.");
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }

    try {
        await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING);
        console.log("MongoDB connected successfully");
        return mongoose;
    } catch (error) {
        console.error("MongoDB connection error:", error);
        throw error;
    }
};
