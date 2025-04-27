import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import { logger } from './logger';
import dotenv from "dotenv";
import { PACKAGE_ID, MODULE_NAME } from "../services/attestOrCreateProof.service";

dotenv.config();

// Constants
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

import { 
  estimateFeeRate, 
  getWalletBalance, 
  sendBitcoinTransaction,
  initializeBitcoinWallet
} from './bitcoin-wallet';

/**
 * Initialize the Bitcoin wallet service
 */
export function initializeBitcoinWithdrawalService() {
  try {
    initializeBitcoinWallet();
    logger.info('Bitcoin withdrawal service initialized successfully');
  } catch (error: any) {
    logger.error(`Failed to initialize Bitcoin withdrawal service: ${error.message}`);
  }
}

/**
 * Validates a Bitcoin address format
 * @param bitcoinAddress The Bitcoin address to validate
 * @returns Whether the address is valid
 */
export function validateBitcoinAddress(bitcoinAddress: string): boolean {
  // Basic validation for Bitcoin address formats
  // P2PKH addresses start with 1
  // P2SH addresses start with 3
  // Bech32 addresses start with bc1
  return !!bitcoinAddress.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/) || 
         !!bitcoinAddress.match(/^bc1[a-z0-9]{39,59}$/);
}

/**
 * Check if there's sufficient Bitcoin balance for this withdrawal
 * @param amount The amount to withdraw
 * @returns Whether there's sufficient balance
 */
async function checkSufficientBitcoinBalance(amount: number): Promise<boolean> {
  try {
    const balance = await getWalletBalance();
    logger.info(`Current wallet balance: ${balance} satoshis, requested amount: ${amount} satoshis`);
    
    // Allow withdrawals only if we have at least 20% more than the requested amount
    // This accounts for fees and prevents draining the wallet completely
    const minimumRequired = Math.floor(amount * 1.2);
    
    return balance >= minimumRequired;
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
    if (!validateBitcoinAddress(bitcoinAddress)) {
      logger.error(`Invalid Bitcoin address format: ${bitcoinAddress}`);
      return null;
    }
    
    // Check for reasonable amount
    const MIN_WITHDRAWAL = 10000; // 10,000 satoshis (0.0001 BTC)
    const MAX_WITHDRAWAL = 1000000000; // 10 BTC in satoshis
    
    if (amount < MIN_WITHDRAWAL) {
      logger.error(`Withdrawal amount too small: ${amount} satoshis (minimum: ${MIN_WITHDRAWAL})`);
      return null;
    }
    
    if (amount > MAX_WITHDRAWAL) {
      logger.error(`Withdrawal amount too large: ${amount} satoshis (maximum: ${MAX_WITHDRAWAL})`);
      return null;
    }
    
    // Check if we have sufficient balance
    const hasSufficientBalance = await checkSufficientBitcoinBalance(amount);
    if (!hasSufficientBalance) {
      logger.error(`Insufficient Bitcoin balance for withdrawal of ${amount} satoshis`);
      return null;
    }
    
    // Send the transaction
    const txHash = await sendBitcoinTransaction(bitcoinAddress, amount);
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