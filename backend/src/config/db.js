import mongoose from "mongoose";

let connectionPromise = null;

const getDatabaseName = () => (
    mongoose.connection.name
    || mongoose.connection.db?.databaseName
    || "unknown"
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A lossy network path (e.g. Wi-Fi to MongoDB Atlas) can stall the TLS
// handshake. Fail those sockets quickly (connectTimeoutMS) and let the
// driver rescan hosts within serverSelectionTimeoutMS instead of hanging
// for the 30s defaults.
const CONNECTION_OPTIONS = {
    connectTimeoutMS: 8000,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 60000,
    heartbeatFrequencyMS: 10000,
    family: 4,
};

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
            .connect(process.env.MONGODB_CONNECTIONSTRING, CONNECTION_OPTIONS)
            .then(() => {
                console.log(`MongoDB connected successfully (database: ${getDatabaseName()})`);
                return mongoose;
            })
            .catch((error) => {
                console.error("MongoDB connection error:", error.message);
                throw error;
            })
            .finally(() => {
                connectionPromise = null;
            });
    }

    return connectionPromise;
};

// Retry with exponential backoff until MongoDB is reachable so a slow or
// flaky database never crashes the HTTP server during startup.
export const ensureConnected = async (onConnected) => {
    let delayMs = 2000;
    for (;;) {
        try {
            await connectDB();
            if (typeof onConnected === "function") {
                onConnected();
            }
            return;
        } catch (error) {
            console.error(`MongoDB unavailable: ${error.message}. Retrying in ${delayMs / 1000}s...`);
            await sleep(delayMs);
            delayMs = Math.min(delayMs * 2, 30000);
        }
    }
};
