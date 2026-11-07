import mongoose from "mongoose";

let connectionPromise = null;

const getDatabaseName = () => (
    mongoose.connection.name
    || mongoose.connection.db?.databaseName
    || "unknown"
);

export const connectDB = async () => {
    if (!process.env.MONGODB_CONNECTIONSTRING) {
        throw new Error("MONGODB_CONNECTIONSTRING is required.");
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }

    // Share a single in-flight connection attempt so concurrent requests
    // (startup, health checks, API calls) cannot open duplicate connections.
    if (!connectionPromise) {
        connectionPromise = mongoose
            .connect(process.env.MONGODB_CONNECTIONSTRING)
            .then(() => {
                console.log(`MongoDB connected successfully (database: ${getDatabaseName()})`);
                return mongoose;
            })
            .catch((error) => {
                console.error("MongoDB connection error:", error);
                throw error;
            })
            .finally(() => {
                connectionPromise = null;
            });
    }

    return connectionPromise;
};
