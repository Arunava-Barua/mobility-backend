import * as bitcoin from 'bitcoinjs-lib';
import axios from 'axios';
import { logger } from './logger';
import { BLOCKSTREAM_BITCOIN_API_URL } from './constants';

// Configuration
// These would normally be in environment variables
const BITCOIN_NETWORK = bitcoin.networks.testnet; // Use testnet for development, bitcoin.networks.bitcoin for mainnet
const MASTER_PRIVATE_KEY = process.env.MASTER_BITCOIN_PRIVATE_KEY || '';
const MIN_CONFIRMATIONS = 2;

// Fee estimation URL
const FEE_ESTIMATION_URL = 'https://mempool.space/api/v1/fees/recommended';

// Cache and state management
let cachedUtxos: any[] = [];
let lastUtxoFetch = 0;
const UTXO_CACHE_TTL = 60000; // 1 minute

/**
 * Initialize the Bitcoin wallet
 */
export const initializeBitcoinWallet = () => {
  if (!MASTER_PRIVATE_KEY) {
    logger.error('MASTER_BITCOIN_PRIVATE_KEY environment variable is not set');
    throw new Error('Bitcoin wallet private key not configured');
  }
  
  try {
    // Verify the private key is valid
    getKeyPair();
    logger.info('Bitcoin wallet initialized successfully');
  } catch (error: any) {
    logger.error(`Failed to initialize Bitcoin wallet: ${error.message}`);
    throw error;
  }
};

/**
 * Get the key pair from the private key
 * @returns The Bitcoin key pair
 */
const getKeyPair = () => {
  try {
    return bitcoin.ECPair.fromWIF(MASTER_PRIVATE_KEY, BITCOIN_NETWORK);
  } catch (error: any) {
    logger.error(`Invalid Bitcoin private key: ${error.message}`);
    throw new Error('Invalid Bitcoin private key format');
  }
};

/**
 * Get the public address for the wallet
 * @returns The Bitcoin address
 */
export const getBitcoinAddress = (): string => {
  try {
    const keyPair = getKeyPair();
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey,
      network: BITCOIN_NETWORK
    });
    
    return address || '';
  } catch (error: any) {
    logger.error(`Error getting Bitcoin address: ${error.message}`);
    throw error;
  }
};

/**
 * Fetch UTXOs for the wallet
 * @param forceRefresh Whether to force a refresh of the cache
 * @returns Array of unspent transaction outputs
 */
export const getUtxos = async (forceRefresh = false): Promise<any[]> => {
  try {
    const now = Date.now();
    const address = getBitcoinAddress();
    
    // Return cached UTXOs if they're still fresh and refresh not forced
    if (!forceRefresh && cachedUtxos.length > 0 && (now - lastUtxoFetch) < UTXO_CACHE_TTL) {
      return cachedUtxos;
    }
    
    // Fetch UTXOs from Blockstream API
    const response = await axios.get(`${BLOCKSTREAM_BITCOIN_API_URL}/address/${address}/utxo`);
    
    // Filter UTXOs to only include confirmed ones
    const utxos = response.data.filter((utxo: any) => utxo.status.confirmed);
    
    // Get transaction details for each UTXO to have complete information
    const utxosWithDetails = await Promise.all(utxos.map(async (utxo: any) => {
      const txResponse = await axios.get(`${BLOCKSTREAM_BITCOIN_API_URL}/tx/${utxo.txid}`);
      
      return {
        ...utxo,
        value: utxo.value,
        txHex: txResponse.data.hex
      };
    }));
    
    // Update cache
    cachedUtxos = utxosWithDetails;
    lastUtxoFetch = now;
    
    logger.info(`Fetched ${utxosWithDetails.length} UTXOs for address ${address}`);
    return utxosWithDetails;
  } catch (error: any) {
    logger.error(`Error fetching UTXOs: ${error.message}`);
    // If we have cached UTXOs, return them as fallback
    if (cachedUtxos.length > 0) {
      logger.warn('Using cached UTXOs due to error fetching fresh data');
      return cachedUtxos;
    }
    throw error;
  }
};

/**
 * Get the current wallet balance
 * @returns The balance in satoshis
 */
export const getWalletBalance = async (): Promise<number> => {
  try {
    const utxos = await getUtxos();
    const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    logger.info(`Current wallet balance: ${balance} satoshis`);
    return balance;
  } catch (error: any) {
    logger.error(`Error getting wallet balance: ${error.message}`);
    throw error;
  }
};

/**
 * Estimate the fee rate
 * @returns Fee rate in satoshis per byte
 */
export const estimateFeeRate = async (): Promise<number> => {
  try {
    // Fetch recommended fees from mempool.space
    const response = await axios.get(FEE_ESTIMATION_URL);
    
    // Convert fees from BTC/kB to satoshis/byte
    // We'll use the hourFee rate which is a middle ground
    // hourFee is in BTC/kB, so we convert to satoshis/byte
    const feeRate = Math.ceil(response.data.hourFee * 100000000 / 1000);
    
    logger.info(`Estimated fee rate: ${feeRate} satoshis/byte`);
    return feeRate;
  } catch (error: any) {
    logger.error(`Error estimating fee rate: ${error.message}`);
    // Return a conservative estimate if API fails
    return 10; // 10 satoshis/byte
  }
};

/**
 * Create and broadcast a Bitcoin transaction
 * @param destinationAddress The address to send BTC to
 * @param amount Amount in satoshis to send
 * @returns Transaction hash if successful
 */
export const sendBitcoinTransaction = async (
  destinationAddress: string,
  amount: number
): Promise<string> => {
  try {
    logger.info(`Creating transaction to ${destinationAddress} for ${amount} satoshis`);
    
    // Basic validation
    if (!destinationAddress) {
      throw new Error('Destination address is required');
    }
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    // Get current fee rate
    const feeRate = await estimateFeeRate();
    
    // Get available UTXOs
    const utxos = await getUtxos(true); // Force refresh
    
    if (utxos.length === 0) {
      throw new Error('No UTXOs available');
    }
    
    // Calculate total available balance
    const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    // Initialize transaction
    const psbt = new bitcoin.Psbt({ network: BITCOIN_NETWORK });
    
    // Add inputs
    let inputAmount = 0;
    let estimatedTxSize = 0;
    
    // Sort UTXOs by value (ascending) to minimize the number of inputs
    const sortedUtxos = [...utxos].sort((a, b) => a.value - b.value);
    
    // Select UTXOs to use
    const selectedUtxos = [];
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      inputAmount += utxo.value;
      
      // Estimate the transaction size
      // Each input adds ~148 bytes, output ~34 bytes, overhead ~10 bytes
      estimatedTxSize = (selectedUtxos.length * 148) + (2 * 34) + 10; // 2 outputs: destination and change
      
      // Estimate fee
      const estimatedFee = estimatedTxSize * feeRate;
      
      // If we have enough to cover the amount + fee, stop adding inputs
      if (inputAmount >= (amount + estimatedFee + 1000)) { // Add 1000 satoshis buffer
        break;
      }
    }
    
    // Calculate fee
    const fee = estimatedTxSize * feeRate;
    
    // Check if we have enough balance
    if (inputAmount < (amount + fee)) {
      throw new Error(`Insufficient balance. Required: ${amount + fee}, Available: ${inputAmount}`);
    }
    
    // Calculate change amount
    const changeAmount = inputAmount - amount - fee;
    
    logger.info(`Transaction details: Inputs: ${selectedUtxos.length}, Total: ${inputAmount}, Fee: ${fee}, Change: ${changeAmount}`);
    
    // Add inputs to transaction
    for (const utxo of selectedUtxos) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoin.address.toOutputScript(getBitcoinAddress(), BITCOIN_NETWORK),
          value: utxo.value,
        },
      });
    }
    
    // Add destination output
    psbt.addOutput({
      address: destinationAddress,
      value: amount,
    });
    
    // Add change output if needed
    if (changeAmount > 546) { // Dust threshold
      psbt.addOutput({
        address: getBitcoinAddress(),
        value: changeAmount,
      });
    }
    
    // Sign all inputs
    const keyPair = getKeyPair();
    for (let i = 0; i < selectedUtxos.length; i++) {
      psbt.signInput(i, keyPair);
    }
    
    // Finalize all inputs
    psbt.finalizeAllInputs();
    
    // Extract transaction
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    
    // Broadcast transaction
    const broadcastResponse = await axios.post(
      `${BLOCKSTREAM_BITCOIN_API_URL}/tx`,
      txHex
    );
    
    const txHash = tx.getId();
    logger.info(`Transaction broadcasted with hash: ${txHash}`);
    
    // Invalidate the UTXO cache after sending
    cachedUtxos = [];
    lastUtxoFetch = 0;
    
    return txHash;
  } catch (error: any) {
    logger.error(`Error sending Bitcoin transaction: ${error.message}`);
    throw error;
  }
};