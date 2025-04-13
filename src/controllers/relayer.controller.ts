import { Request, Response } from 'express';
import * as relayerService from '../services/relayer.service';
import { logger } from '../utils/logger';

/**
 * Submit a transaction to be relayed
 */
export const submitTransaction = async (req: Request, res: Response) => {
  try {
    const { transaction, signature } = req.body;
    
    if (!transaction || !signature) {
      return res.status(400).json({
        status: 'error',
        message: 'Transaction data and signature are required'
      });
    }
    
    const result = await relayerService.submitTransaction(transaction, signature);
    
    return res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    logger.error(`Error submitting transaction: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Error processing transaction'
    });
  }
};

/**
 * Get transaction status by ID
 */
export const getTransactionStatus = async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    
    if (!txId) {
      return res.status(400).json({
        status: 'error',
        message: 'Transaction ID is required'
      });
    }
    
    const transaction = await relayerService.getTransactionById(txId);
    
    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: transaction
    });
  } catch (error: any) {
    logger.error(`Error fetching transaction: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Error fetching transaction'
    });
  }
};

/**
 * Get all transactions with pagination
 */
export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const { transactions, total } = await relayerService.getAllTransactions(page, limit);
    
    return res.status(200).json({
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
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Error fetching transactions'
    });
  }
};
