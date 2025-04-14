import { Request, Response, NextFunction } from 'express';
import * as relayerService from '../services/relayer.service';
import { logger } from '../utils/logger';

/**
 * Submit a transaction to be relayed
 */
export const submitTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { transaction, signature } = req.body;
    
    if (!transaction || !signature) {
      res.status(400).json({
        status: 'error',
        message: 'Transaction data and signature are required'
      });
      return;
    }
    
    const result = await relayerService.submitTransaction(transaction, signature);
    
    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    logger.error(`Error submitting transaction: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error processing transaction'
    });
  }
};

/**
 * Process a user's Bitcoin deposit
 */
export const processDeposit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { suiAddress, bitcoinAddress, bitcoinTxHash } = req.body;
    
    if (!suiAddress || !bitcoinAddress || !bitcoinTxHash) {
      res.status(400).json({
        status: 'error',
        message: 'Sui address, Bitcoin address, and Bitcoin transaction hash are required'
      });
      return;
    }
    
    const result = await relayerService.processDeposit(suiAddress, bitcoinAddress, bitcoinTxHash);
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    logger.error(`Error processing deposit: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error processing deposit'
    });
  }
};

/**
 * Get transaction status by ID
 */
export const getTransactionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { txId } = req.params;
    
    if (!txId) {
      res.status(400).json({
        status: 'error',
        message: 'Transaction ID is required'
      });
      return;
    }
    
    const transaction = await relayerService.getTransactionById(txId);
    
    if (!transaction) {
      res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
      return;
    }
    
    res.status(200).json({
      status: 'success',
      data: transaction
    });
  } catch (error: any) {
    logger.error(`Error fetching transaction: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error fetching transaction'
    });
  }
};

/**
 * Get all transactions with pagination
 */
export const getAllTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const { transactions, total } = await relayerService.getAllTransactions(page, limit);
    
    res.status(200).json({
      status: 'success',
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error fetching transactions: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error fetching transactions'
    });
  }
};
