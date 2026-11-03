import mongoose from 'mongoose';

let connectionPromise = null;

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_CONNECTIONSTRING;
  if (!mongoUri) {
    throw new Error('MONGODB_CONNECTIONSTRING is required.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // Share one in-flight connection attempt across concurrent cold-start requests.
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose.connect(mongoUri)
    .then(() => {
      console.log('MongoDB connected successfully');
      return mongoose;
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};
