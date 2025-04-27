import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import { logger } from './logger';
import axios from "axios";
import dotenv from "dotenv";
import { PACKAGE_ID, MODULE_NAME } from "../services/attestOrCreateProof.service";

dotenv.config();

// Constants
const MASTER_PRIVATE_KEY = process.env.MASTER_PRIVATE_KEY;
const MASTER_REGISTRY_ID = process.env.MASTER_REGISTRY_ID;

// Threshold for withdrawal confirmations (for now we'll set it to 1 since there's only one relayer)
export const WITHDRAWAL_ATTESTATION_THRESHOLD = 1;

/**
 * Listens for WithdrawRequest events on the Sui blockchain
 * @returns Promise resolving to an array of withdrawal events
 */
export async function listenForWithdrawEvents(): Promise<any[]> {
  try {
    logger.info('Listening for WithdrawRequest events on Sui blockchain');
    
    // Initialize Sui client
    const client = new SuiClient({ url: getFullnodeUrl("testnet") });
    
    // Query for events from the last 24 hours
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const events = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::WithdrawRequest`,
        TimeRange: {
          startTime: startTime.getTime().toString(),
          endTime: Date.now().toString(),
        }
      }
    });
    
    logger.info(`Found ${events.data.length} WithdrawRequest events`);
    
    // Process events
    return events.data.map((event: any) => {
      // Parse event data based on your smart contract structure
      const eventData = event.parsedJson;
      
      return {
        eventId: event.id,
        suiAddress: eventData.user,
        bitcoinAddress: eventData.btc_address, // This might be in bytes format
        amount: BigInt(eventData.amount),
        timestamp: new Date(event.timestampMs)
      };
    });
  } catch (error: any) {
    logger.error(`Error listening for withdraw events: ${error.message}`);
    return [];
  }
}

/**
 * Verifies if a user has sufficient balance for withdrawal
 * @param suiAddress The Sui blockchain address of the user
 * @param collateralProofId The collateral proof object ID
 * @param amount The amount to withdraw (in satoshis)
 * @returns Promise resolving to boolean indicating if user has sufficient funds
 */
export async function verifyWithdrawalAllowance(
  suiAddress: string,
  collateralProofId: string,
  amount: number
): Promise<boolean> {
  try {
    logger.info(`Verifying withdrawal allowance for ${suiAddress} of ${amount} satoshis`);
    
    if (!collateralProofId) {
      logger.warn(`No collateral proof ID provided for ${suiAddress}`);
      return false;
    }
    
    // Initialize Sui client
    const client = new SuiClient({ url: getFullnodeUrl("testnet") });
    
    // Get collateral details from the blockchain
    const object = await client.getObject({
      id: collateralProofId,
      options: { showContent: true }
    });
    
    // Extract available balance (this depends on your specific smart contract)
    const content = object.data?.content;
    if (!content || content.dataType !== "moveObject") {
      logger.warn(`Could not retrieve collateral content for ${collateralProofId}`);
      return false;
    }    
    
    // Check if user has sufficient balance
    // Note: This implementation needs to be adjusted based on your specific smart contract structure
    const fields = content.fields as any;
    const availableBalance = BigInt(fields.balance || 0);
    
    logger.info(`Available balance: ${availableBalance}, Requested: ${amount}`);
    
    return availableBalance >= amount;
  } catch (error: any) {
    logger.error(`Error verifying withdrawal allowance: ${error.message}`);
    return false;
  }
}

/**
 * Initiates a withdrawal on the Sui blockchain by calling withdraw_btc
 * @param suiAddress The Sui blockchain address of the user
 * @param bitcoinAddress The Bitcoin address for withdrawal
 * @param collateralProofId The collateral proof object ID
 * @param amount The amount to withdraw (in satoshis)
 * @returns Promise resolving to transaction hash if successful, null otherwise
 */
export async function initiateWithdrawal(
  suiAddress: string,
  bitcoinAddress: string,
  collateralProofId: string,
  amount: number
): Promise<string | null> {
  try {
    logger.info(`Initiating withdrawal for ${suiAddress} to ${bitcoinAddress}`);
    logger.info(`Collateral proof ID: ${collateralProofId}`);
    logger.info(`Amount (satoshis): ${amount}`);
    
    if (!process.env.RELAYER_PRIVATE_KEY) {
      throw new Error("RELAYER_PRIVATE_KEY environment variable is not set");
    }
    
    // Initialize Sui client
    const client = new SuiClient({ url: getFullnodeUrl("testnet") });
    
    // Get keypair from environment
    const keypair = Ed25519Keypair.fromSecretKey(fromBase64(process.env.RELAYER_PRIVATE_KEY));
    
    // Create transaction to initiate withdrawal
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::withdraw_btc`,
      arguments: [
        tx.object(collateralProofId),
        tx.pure.u64(amount),
        tx.pure(Buffer.from(bitcoinAddress)),
      ],
    });
    
    // Sign and execute transaction
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
    
    logger.info(`Withdrawal initiated with tx digest: ${result.digest}`);
    
    return result.digest;
  } catch (error: any) {
    logger.error(`Error initiating withdrawal: ${error.message}`);
    return null;
  }
}

/**
 * Calculates the current Bitcoin network fee rate
 * @returns Estimated fee rate in satoshis per byte
 */
async function estimateBitcoinFee(): Promise<number> {
  try {
    // In a real implementation, you would:
    // - Query a Bitcoin fee estimation service
    // - Get the current recommended fee rate
    // - Return it in satoshis per byte
    
    // For now, return a fixed fee rate
    return 10; // 10 satoshis per byte - standard fee
  } catch (error: any) {
    logger.error(`Error estimating Bitcoin fee rate: ${error.message}`);
    return 20; // Higher fallback fee to ensure transaction gets confirmed
  }
}

/**
 * Check if there's sufficient Bitcoin balance for this withdrawal
 * @param amount The amount to withdraw
 * @returns Whether there's sufficient balance
 */
async function checkSufficientBitcoinBalance(amount: number): Promise<boolean> {
  try {
    // In a real implementation, you would:
    // - Query your Bitcoin wallet or service
    // - Get the current available balance
    // - Compare with the requested amount plus fees
    
    // For now, assume we have sufficient balance for testing
    return true;
  } catch (error: any) {
    logger.error(`Error checking Bitcoin balance: ${error.message}`);
    return false;
  }
}

/**
 * Processes a withdrawal by generating and broadcasting a Bitcoin transaction
 * @param bitcoinAddress The Bitcoin address to send funds to
 * @param amount The amount to send (in satoshis)
 * @returns Promise resolving to transaction hash if successful, null otherwise
 */
export async function processWithdrawalToBitcoin(
  bitcoinAddress: string,
  amount: number
): Promise<string | null> {
  try {
    logger.info(`Processing Bitcoin withdrawal to ${bitcoinAddress} of ${amount} satoshis`);
    
    // Validate Bitcoin address format
    if (!bitcoinAddress.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/) && 
        !bitcoinAddress.match(/^bc1[a-z0-9]{39,59}$/)) {
      logger.error(`Invalid Bitcoin address format: ${bitcoinAddress}`);
      return null;
    }
    
    // Check for reasonable amount
    if (amount <= 0 || amount > 1000000000) { // Max 10 BTC
      logger.error(`Invalid withdrawal amount: ${amount}`);
      return null;
    }
    
    // Estimate the network fee
    const feeRate = await estimateBitcoinFee();
    
    // Estimate transaction size (typical P2PKH transaction)
    const estimatedTxSize = 250; // bytes
    
    // Calculate the fee
    const fee = feeRate * estimatedTxSize;
    
    // Check if we need to adjust the amount
    const totalAmount = amount + fee;
    
    // Check if we have sufficient balance
    const hasSufficientBalance = await checkSufficientBitcoinBalance(totalAmount);
    if (!hasSufficientBalance) {
      logger.error(`Insufficient Bitcoin balance for withdrawal of ${amount} satoshis plus ${fee} fee`);
      return null;
    }
    
    // This would typically involve:
    // 1. Connecting to a Bitcoin wallet or service
    // 2. Creating a transaction
    // 3. Signing it with the master wallet private key
    // 4. Broadcasting it to the Bitcoin network
    
    // For now, we'll simulate this with a mock transaction
    // In a real implementation, you would:
    // - Use a Bitcoin library like bitcoinjs-lib
    // - Connect to a Bitcoin node or service
    // - Create and sign a real transaction
    
    logger.info(`Creating Bitcoin transaction to ${bitcoinAddress} for ${amount} satoshis with fee ${fee} satoshis`);
    
    // Add jitter to simulate real transaction processing
    const processingTime = 2000 + Math.floor(Math.random() * 1000);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Generate a mock transaction hash
    const txHash = `mock_bitcoin_tx_${Date.now().toString(16)}`;
    
    logger.info(`Bitcoin withdrawal processed with transaction hash: ${txHash}`);
    
    return txHash;
  } catch (error: any) {
    logger.error(`Error processing Bitcoin withdrawal: ${error.message}`);
    return null;
  }
}

/**
 * Attests to a withdrawal event by the relayer
 * @param eventId The ID of the withdrawal event
 * @returns Promise resolving to boolean indicating success
 */
export async function attestWithdrawal(
  transactionId: string
): Promise<boolean> {
  try {
    logger.info(`Attesting to withdrawal transaction ${transactionId}`);
    
    // In a real implementation with multiple relayers:
    // 1. Each relayer would sign the withdrawal event
    // 2. The signature would be submitted to the master backend
    // 3. The master would verify the signature
    
    // Since we only have one relayer, we'll just increment the attestation count
    // Normally this would be done through a separate API endpoint
    
    return true;
  } catch (error: any) {
    logger.error(`Error attesting to withdrawal: ${error.message}`);
    return false;
  }
}