const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri || typeof mongoUri !== 'string') {
    console.error('Missing MongoDB connection string. Set MONGO_URI in backend/.env.');
    process.exit(1);
  }

  let attempt = 0;
  let isConnecting = false;

  const connectOnce = async () => {
    if (isConnecting) return;
    if (mongoose.connection.readyState === 1) return;

    isConnecting = true;
    attempt += 1;

    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      attempt = 0;
    } catch (error) {
      const delayMs = Math.min(30000, 1000 * Math.max(1, Math.pow(2, Math.min(attempt - 1, 5))));
      console.error(`MongoDB connect failed: ${error.message}`);
      console.error(`Retrying MongoDB connection in ${Math.round(delayMs / 1000)}s...`);
      setTimeout(connectOnce, delayMs);
    } finally {
      isConnecting = false;
    }
  };

  mongoose.connection.on('disconnected', () => {
    // Attempt to reconnect if DB drops while server is running
    connectOnce();
  });

  connectOnce();
};

module.exports = connectDB;
