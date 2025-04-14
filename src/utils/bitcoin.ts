import axios from "axios";
import { BLOCKSTREAM_BITCOIN_API_URL, MIN_REQUIRED_CONFIRMATIONS } from "./constants";
import { logger } from "./logger";

/**
 * Verifies a Bitcoin transaction by checking if it exists and has enough confirmations
 * @param txHash The Bitcoin transaction hash to verify
 * @returns Promise resolving to boolean indicating if transaction is confirmed with enough confirmations
 */
export async function verifyBitcoinTransaction(txHash: string): Promise<boolean> {
    logger.info(`Verifying Bitcoin transaction with hash: ${txHash}`);
    
    try {
        // Get current blockchain height
        const blockchainResponse = await axios.get(
            `${BLOCKSTREAM_BITCOIN_API_URL}/blocks/tip/height`
        );
        const currentHeight = parseInt(blockchainResponse.data);
        
        // Get transaction details
        const response = await axios.get(`${BLOCKSTREAM_BITCOIN_API_URL}/tx/${txHash}`);
        
        if (response.data && response.data.status.confirmed) {
            const confirmations = currentHeight - response.data.status.block_height + 1;
            
            logger.info(`Bitcoin transaction confirmed with ${confirmations} confirmations.`);
            
            if (confirmations < MIN_REQUIRED_CONFIRMATIONS) {
                logger.warn(
                    `Transaction fails to meet minimum confirmation threshold of ${MIN_REQUIRED_CONFIRMATIONS}.`
                );
                return false;
            } else {
                logger.info(
                    `Transaction meets minimum confirmation threshold of ${MIN_REQUIRED_CONFIRMATIONS}.`
                );
                return true;
            }
        } else {
            logger.warn("Transaction exists but not confirmed yet.");
            return false;
        }
    } catch (error: any) {
        logger.error(`Error verifying Bitcoin transaction: ${error.message}`);
        return false;
    }
}

/**
 * Gets transaction details from the Bitcoin blockchain
 * @param txHash The Bitcoin transaction hash
 * @returns Promise resolving to transaction details or null if not found
 */
export async function getBitcoinTransactionDetails(txHash: string): Promise<any | null> {
    try {
        const response = await axios.get(`${BLOCKSTREAM_BITCOIN_API_URL}/tx/${txHash}`);
        return response.data;
    } catch (error: any) {
        logger.error(`Error fetching Bitcoin transaction details: ${error.message}`);
        return null;
    }
}