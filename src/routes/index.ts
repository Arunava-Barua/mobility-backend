import { Router } from 'express';
import relayerRoutes from './relayer.routes';

const router = Router();

// Register routes
router.use('/relayer', relayerRoutes);

export default router;
