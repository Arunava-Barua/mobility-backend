import { Router } from 'express';
import * as relayerController from '../controllers/relayer.controller';

const router = Router();

/**
 * @route POST /api/relayer/transaction
 * @desc Submit a transaction to be relayed
 */
router.post('/transaction', relayerController.submitTransaction);

/**
 * @route GET /api/relayer/transaction/:txId
 * @desc Get transaction status by ID
 */
router.get('/transaction/:txId', relayerController.getTransactionStatus);

/**
 * @route GET /api/relayer/transactions
 * @desc Get all transactions (with pagination)
 */
router.get('/transactions', relayerController.getAllTransactions);

export default router;
