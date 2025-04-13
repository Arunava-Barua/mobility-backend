import { logger } from '../utils/logger';
import Transaction from '../models/transaction.model';

/**
 * Submit a transaction to be relayed
 * @param transaction Transaction data
 * @param signature Signature of the transaction
 * @returns Transaction object
 */
export const submitTransaction = async (transaction: any, signature: string) => {
  try {
    // Validate transaction and signature (implement validation logic)
    // This would typically include verifying the signature against the transaction data
    
    // Create new transaction record
    const newTransaction = new Transaction({
      data: transaction,
      signature,
      status: 'pending',
      createdAt: new Date()
    });
    
    // Save to database
    await newTransaction.save();
    
    // Here you would typically queue the transaction for processing
    // This could involve sending it to a blockchain or other system
    // For now, we'll just log it
    logger.info(`Transaction queued for processing: ${newTransaction._id}`);
    
    // Return transaction details
    return {
      id: newTransaction._id,
      status: newTransaction.status,
      createdAt: newTransaction.createdAt
    };
  } catch (error: any) {
    logger.error(`Error in submitTransaction service: ${error.message}`);
    throw new Error(`Failed to submit transaction: ${error.message}`);
  }
};

/**
 * Get transaction by ID
 * @param txId Transaction ID
 * @returns Transaction object
 */
export const getTransactionById = async (txId: string) => {
  try {
    const transaction = await Transaction.findById(txId);
    
    if (!transaction) {
      return null;
    }
    
    return {
      id: transaction._id,
      data: transaction.data,
      status: transaction.status,
      createdAt: transaction.createdAt,
      processedAt: transaction.processedAt,
      hash: transaction.hash
    };
  } catch (error: any) {
    logger.error(`Error in getTransactionById service: ${error.message}`);
    throw new Error(`Failed to fetch transaction: ${error.message}`);
  }
};

/**
 * Get all transactions with pagination
 * @param page Page number
 * @param limit Items per page
 * @returns Transactions and total count
 */
export const getAllTransactions = async (page: number, limit: number) => {
  try {
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Transaction.countDocuments();
    
    return {
      transactions: transactions.map(tx => ({
        id: tx._id,
        data: tx.data,
        status: tx.status,
        createdAt: tx.createdAt,
        processedAt: tx.processedAt,
        hash: tx.hash
      })),
      total
    };
  } catch (error: any) {
    logger.error(`Error in getAllTransactions service: ${error.message}`);
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }
};
