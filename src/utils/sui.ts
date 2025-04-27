import { logger } from './logger';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { getBitcoinTransactionDetails } from './bitcoin';
import { getCollateralProofObject, createCollateralProof, attestBtcDeposit } from '../services/attestOrCreateProof.service';

/**
 * Checks if a collateral object exists for the given user
 * @param suiAddress The Sui blockchain address of the user
 * @returns Promise resolving to boolean indicating if collateral exists
 */
export async function checkCollateralExists(suiAddress: string): Promise<boolean> {
    try {
        logger.info(`Checking if collateral exists for Sui address: ${suiAddress}`);
        
        const proofId = await getCollateralProofObject(suiAddress);
        const exists = !!proofId;
        
        logger.info(`Collateral ${exists ? 'exists' : 'does not exist'} for address: ${suiAddress}`);
        
        return exists;
    } catch (error: any) {
        logger.error(`Error checking collateral existence: ${error.message}`);
        return false;
    }
}

/**
 * Creates a collateral object for the user
 * @param suiAddress The Sui blockchain address of the user
 * @param bitcoinAddress The Bitcoin address of the user
 * @param bitcoinTxHash The Bitcoin transaction hash
 * @returns Promise resolving to transaction hash if successful, null otherwise
 */
export async function createCollateralObject(
    suiAddress: string, 
    bitcoinAddress: string, 
    bitcoinTxHash: string
): Promise<string | null> {
    try {
        logger.info(`Creating collateral object for Sui address: ${suiAddress}`);
        logger.info(`Bitcoin address: ${bitcoinAddress}`);
        logger.info(`Bitcoin transaction hash: ${bitcoinTxHash}`);
        
        // Create the collateral proof
        const proofId = await createCollateralProof(suiAddress);
        
        // Get transaction details from Bitcoin blockchain
        const txDetails = await getBitcoinTransactionDetails(bitcoinTxHash);
        if (!txDetails) {
            throw new Error('Failed to retrieve Bitcoin transaction details');
        }
        
        // Extract amount from transaction (this is simplified, in a real implementation
        // we would need to identify the correct output for the specified address)
        const amount = BigInt(txDetails.vout[0].value * 100000000); // Convert BTC to satoshis
        
        // Attest the BTC deposit
        const result = await attestBtcDeposit(suiAddress, bitcoinTxHash, amount);
        
        logger.info(`Collateral object created and BTC deposit attested with transaction hash: ${result}`);
        
        return result;
    } catch (error: any) {
        logger.error(`Error creating collateral object: ${error.message}`);
        return null;
    }
}

/**
 * Attests data to an existing collateral proof
 * @param suiAddress The Sui blockchain address of the user
 * @param bitcoinAddress The Bitcoin address of the user
 * @param bitcoinTxHash The Bitcoin transaction hash
 * @returns Promise resolving to transaction hash if successful, null otherwise
 */
export async function attestToCollateral(
    suiAddress: string, 
    bitcoinAddress: string, 
    bitcoinTxHash: string
): Promise<string | null> {
    try {
        logger.info(`Attesting to collateral for Sui address: ${suiAddress}`);
        logger.info(`Bitcoin address: ${bitcoinAddress}`);
        logger.info(`Bitcoin transaction hash: ${bitcoinTxHash}`);
        
        // Get transaction details from Bitcoin blockchain
        const txDetails = await getBitcoinTransactionDetails(bitcoinTxHash);
        if (!txDetails) {
            throw new Error('Failed to retrieve Bitcoin transaction details');
        }
        
        // Extract amount from transaction (simplified implementation)
        const amount = BigInt(txDetails.vout[0].value * 100000000); // Convert BTC to satoshis
        
        // Attest the BTC deposit to existing collateral
        const result = await attestBtcDeposit(suiAddress, bitcoinTxHash, amount);
        
        logger.info(`Attestation completed with transaction hash: ${result}`);
        
        return result;
    } catch (error: any) {
        logger.error(`Error attesting to collateral: ${error.message}`);
        return null;
    }
}