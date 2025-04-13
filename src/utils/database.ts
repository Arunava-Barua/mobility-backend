import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from './logger';

/**
 * Connect to MongoDB
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongodbUri);
    logger.info('Connected to MongoDB successfully');
  } catch (error: any) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error: any) {
    logger.error(`MongoDB disconnection error: ${error.message}`);
  }
};
