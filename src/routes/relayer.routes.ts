import { Router } from 'express';
import * as relayerController from '../controllers/relayer.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { 
  submitTransactionSchema, 
  processDepositSchema, 
  transactionStatusParamsSchema,
  transactionsListQuerySchema,
  withdrawalAddressParamSchema
} from '../middleware/validators/relayer.validators';

const router = Router();

/**
 * @route POST /api/relayer/transaction
 * @desc Submit a transaction to be relayed
 * @note This endpoint is temporarily disabled until full implementation
 */
/*
router.post(
  '/transaction',
  validateBody(submitTransactionSchema),
  relayerController.submitTransaction
);
*/

/**
 * @route POST /api/relayer/deposit
 * @desc Process a Bitcoin deposit
 */
router.post(
  '/deposit',
  validateBody(processDepositSchema),
  relayerController.processDeposit
);

/**
 * @route GET /api/relayer/transaction/:txId
 * @desc Get transaction status by ID
 */
router.get(
  '/transaction/:txId',
  validateParams(transactionStatusParamsSchema),
  relayerController.getTransactionStatus
);

/**
 * @route GET /api/relayer/transactions
 * @desc Get all transactions (with pagination)
 */
router.get(
  '/transactions',
  validateQuery(transactionsListQuerySchema),
  relayerController.getAllTransactions
);

/**
 * @route GET /api/relayer/withdrawals/:suiAddress
 * @desc Get withdrawal status for a user
 */
router.get(
  '/withdrawals/:suiAddress',
  validateParams(withdrawalAddressParamSchema),
  relayerController.getWithdrawalStatus
);

export default router;
