import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase } from './utils/database';
import routes from './routes';
import { setupWithdrawalListener } from './services/withdrawal.service';
import { setupContinuousEventListener } from './services/event-listener.service';

// Initialize express app
const app: Application = express();
const PORT = config.port || 3000;

// Connect to database
connectDatabase().then(() => {
  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // API Routes
  app.use('/api', routes);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', message: 'Relayer service is running' });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: `Cannot ${req.method} ${req.path}`
    });
  });

  // Error handling middleware for validation errors
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.name === 'ValidationError') {
      logger.warn(`Validation error: ${err.message}`);
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: err.details?.map((detail: any) => detail.message) || [err.message]
      });
    }
    next(err);
  });

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(`Error: ${err.message}`);
    logger.error(err.stack || 'No stack trace available');
    
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
      ...(config.nodeEnv !== 'production' && { error: err.message, stack: err.stack })
    });
  });

  // Start the server
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Health check available at: http://localhost:${PORT}/health`);
    
    // Setup withdrawal processor for pending withdrawals
    setupWithdrawalListener();
    logger.info('Withdrawal processor started');
    
    // Setup continuous event listener for realtime events
    setupContinuousEventListener();
    logger.info('Continuous Sui event listener started');
  });
}).catch(err => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
