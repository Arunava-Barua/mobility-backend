import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase } from './utils/database';
import routes from './routes';

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

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(`Error: ${err.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { error: err.message })
    });
  });

  // Start the server
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}).catch(err => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

export default app;
