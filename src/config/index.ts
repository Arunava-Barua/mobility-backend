import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  logLevel: string;
  jwtSecret: string;
  jwtExpiration: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mobility-relayer',
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_do_not_use_in_production',
  jwtExpiration: process.env.JWT_EXPIRATION || '1d',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
};
