import { logger } from '../utils/logger';
import Transaction from '../models/transaction.model';
import mongoose from 'mongoose';
import { 
  verifyWithdrawalAllowance, 
  initiateWithdrawal, 
  processWithdrawalToBitcoin,
  WITHDRAWAL_ATTESTATION_THRESHOLD
} from '../utils/withdrawal';

/**
 * Store information about a withdrawal event from the Sui blockchain
 * @param suiAddress Sui blockchain address of the user
 * @param bitcoinAddress Bitcoin address for withdrawal
 * @param amount Amount to withdraw (in satoshis)
 * @param eventId The event ID from Sui blockchain
 * @returns Process result object
 */
export const recordWithdrawalEvent = async (
  suiAddress: string,
  bitcoinAddress: string,
  amount: number,
  eventId: string
) => {
  try {
    logger.info(`Recording withdrawal event for user with Sui address: ${suiAddress}`);
    logger.info(`Bitcoin address: ${bitcoinAddress}`);
    logger.info(`Amount (satoshis): ${amount}`);
    logger.info(`Event ID: ${eventId}`);
    
    // Check if this event has already been processed
    const existingTx = await Transaction.findOne({ 
      'data.eventId': eventId,
      type: 'withdrawal'
    });
    
    if (existingTx) {
      logger.info(`Withdrawal event ${eventId} has already been processed, transaction ID: ${existingTx._id}`);
      return {
        id: existingTx._id,
        status: existingTx.status,
        hash: existingTx.hash,
        bitcoinTxHash: existingTx.bitcoinWithdrawalTxHash
      };
    }
    
    // Create a new transaction record
    const transaction = new Transaction({
      data: {
        type: 'withdrawal',
        suiAddress,
        bitcoinAddress,
        amount,
        eventId
      },
      signature: '', // In production, this should be a valid signature
      status: 'processing',
      type: 'withdrawal',
      suiAddress,
      bitcoinAddress,
      withdrawalAmount: amount,
      createdAt: new Date(),
      withdrawalAttestations: 0,
      withdrawalThresholdReached: false
    });
    
    // Save initial transaction record
    await transaction.save();
    
    // Add attestation (since we only have one relayer)
    return await attestWithdrawal(transaction._id.toString());
  } catch (error: any) {
    logger.error(`Error recording withdrawal event: ${error.message}`);
    throw new Error(`Failed to record withdrawal event: ${error.message}`);
  }
};

/**
 * Update withdrawal attestations
 * Normally this would be called by different relayers, but for now we only have one
 * @param transactionId Transaction ID
 * @returns Updated transaction
 */
export const attestWithdrawal = async (transactionId: string) => {
  let session = null;
  try {
    // Start a database transaction for atomicity
    session = await mongoose.startSession();
    session.startTransaction();
    
    // Find the transaction and lock it during the update
    const transaction = await Transaction.findById(transactionId).session(session);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (transaction.type !== 'withdrawal') {
      throw new Error(`Transaction ${transactionId} is not a withdrawal`);
    }
    
    if (transaction.status !== 'processing') {
      // Transaction is already completed or failed
      // Just return the current state without throwing an error
      return {
        id: transaction._id,
        status: transaction.status,
        attestations: transaction.withdrawalAttestations || 0,
        thresholdReached: transaction.withdrawalThresholdReached || false,
        bitcoinTxHash: transaction.bitcoinWithdrawalTxHash
      };
    }
    
    // Increment attestation count
    transaction.withdrawalAttestations = (transaction.withdrawalAttestations || 0) + 1;
    
    // Check if threshold is reached
    if (transaction.withdrawalAttestations >= WITHDRAWAL_ATTESTATION_THRESHOLD) {
      transaction.withdrawalThresholdReached = true;
      
      // We'll mark it as threshold reached but not process the Bitcoin withdrawal yet
      // That will be handled by the separate withdrawal processor
      logger.info(`Attestation threshold reached for transaction ${transactionId}`);
    }
    
    // Save transaction updates
    await transaction.save({ session });
    
    // Commit the transaction
    await session.commitTransaction();
    
    // Return updated status
    return {
      id: transaction._id,
      status: transaction.status,
      attestations: transaction.withdrawalAttestations,
      thresholdReached: transaction.withdrawalThresholdReached,
      bitcoinTxHash: transaction.bitcoinWithdrawalTxHash
    };
  } catch (error: any) {
    // Rollback transaction on error
    if (session) {
      await session.abortTransaction();
    }
    
    logger.error(`Error in attestWithdrawal service: ${error.message}`);
    throw new Error(`Failed to attest withdrawal: ${error.message}`);
  } finally {
    // End session
    if (session) {
      session.endSession();
    }
  }
};

/**
 * Creates a background job to process pending withdrawals
 * This focuses just on processing withdrawals that have reached the threshold
 * The actual event listening is now handled by the continuous event listener service
 */
export const setupWithdrawalListener = async () => {
  logger.info('Setting up withdrawal processor');
  
  // Process pending withdrawals that need to be processed
  const processPendingWithdrawals = async () => {
    try {
      logger.info('Checking for pending withdrawals');
      
      // Find pending withdrawal transactions that have reached threshold
      const pendingWithdrawals = await Transaction.find({
        type: 'withdrawal',
        status: 'processing',
        withdrawalThresholdReached: true,
        bitcoinWithdrawalTxHash: { $exists: false }
      });
      
      logger.info(`Found ${pendingWithdrawals.length} pending withdrawals to process`);
      
      // Process each pending withdrawal
      for (const withdrawal of pendingWithdrawals) {
        try {
          if (!withdrawal.bitcoinAddress || !withdrawal.withdrawalAmount) {
            withdrawal.status = 'failed';
            withdrawal.error = 'Missing required withdrawal information';
            await withdrawal.save();
            continue;
          }
          
          const bitcoinTxHash = await processWithdrawalToBitcoin(
            withdrawal.bitcoinAddress,
            withdrawal.withdrawalAmount
          );
          
          if (bitcoinTxHash) {
            withdrawal.status = 'completed';
            withdrawal.bitcoinWithdrawalTxHash = bitcoinTxHash;
            withdrawal.processedAt = new Date();
          } else {
            withdrawal.status = 'failed';
            withdrawal.error = 'Failed to process Bitcoin withdrawal';
          }
          
          await withdrawal.save();
          logger.info(`Processed withdrawal ${withdrawal._id} - Status: ${withdrawal.status}`);
        } catch (error: any) {
          logger.error(`Error processing withdrawal ${withdrawal._id}: ${error.message}`);
          
          withdrawal.status = 'failed';
          withdrawal.error = `Error processing withdrawal: ${error.message}`;
          await withdrawal.save();
        }
      }
    } catch (error: any) {
      logger.error(`Error in processing pending withdrawals: ${error.message}`);
    }
  };
  
  // Run the processor on interval
  setInterval(async () => {
    await processPendingWithdrawals();
  }, 30000); // Check every 30 seconds
  
  // Also run immediately on startup
  processPendingWithdrawals().catch(err => 
    logger.error(`Error in initial processing of pending withdrawals: ${err.message}`)
  );
};