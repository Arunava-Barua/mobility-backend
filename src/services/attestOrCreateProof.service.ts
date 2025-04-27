import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

// Constants
export const PACKAGE_ID =
  "0x58fd4af89d8481a971d9458e5410e8952dfbf98f9105060c654757d744efd033";
export const MODULE_NAME = "attest_btc_deposit";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RELAYER_REGISTRY_ID = process.env.RELAYER_REGISTRY_ID!;
const WITNESS_REGISTRY_ID = process.env.WITNESS_REGISTRY_ID!;

// Initialize Sui client
const client = new SuiClient({ url: getFullnodeUrl("testnet") });

if (!RELAYER_PRIVATE_KEY) {
  throw new Error("RELAYER_PRIVATE_KEY environment variable is not set");
}

// Use only the whitelisted keypair - no fallback to temporary keypair
const keypair = Ed25519Keypair.fromSecretKey(fromBase64(RELAYER_PRIVATE_KEY));

/**
 * Gets the collateral proof object for a user
 * @param user The Sui address of the user
 * @returns The object ID of the collateral proof, or null if not found
 */
export async function getCollateralProofObject(user: string): Promise<string | null> {
  try {
    logger.info(`Looking for CollateralProof object for user: ${user}`);
    const result = await client.getOwnedObjects({ owner: user });
    const proof = result.data.find((obj) =>
      obj.data?.type?.includes("CollateralProof")
    );
    
    if (proof?.data?.objectId) {
      logger.info(`Found CollateralProof object: ${proof.data.objectId}`);
      return proof.data.objectId;
    } else {
      logger.info(`No CollateralProof object found for user: ${user}`);
      return null;
    }
  } catch (error: any) {
    logger.error(`Error getting CollateralProof object: ${error.message}`);
    return null;
  }
}

/**
 * Creates a collateral proof object for a user
 * @param user The Sui address of the user
 * @returns The object ID of the created collateral proof
 */
export async function createCollateralProof(user: string): Promise<string> {
  try {
    logger.info(`Creating new CollateralProof for user: ${user}`);
    
    // Validate registry IDs
    if (!WITNESS_REGISTRY_ID) {
      throw new Error("WITNESS_REGISTRY_ID environment variable is not set");
    }
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_collateral_proof`,
      arguments: [tx.object(WITNESS_REGISTRY_ID), tx.pure.address(user)],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });

    logger.info(`CollateralProof creation tx digest: ${result.digest}`);

    // Wait and re-fetch
    await new Promise((res) => setTimeout(res, 2000));
    const objectId = await getCollateralProofObject(user);
    if (!objectId) {
      throw new Error("Failed to find newly created CollateralProof");
    }
    
    logger.info(`Created CollateralProof with ID: ${objectId}`);
    return objectId;
  } catch (error: any) {
    logger.error(`Error creating CollateralProof: ${error.message}`);
    throw error;
  }
}

/**
 * Attests a Bitcoin deposit to a collateral proof
 * @param user The Sui address of the user
 * @param btcTxnHash The Bitcoin transaction hash
 * @param amount The amount in satoshis
 * @returns The transaction digest
 */
export async function attestBtcDeposit(
  user: string,
  btcTxnHash: string,
  amount: bigint
): Promise<string> {
  try {
    logger.info(`Attesting BTC deposit for user: ${user}`);
    logger.info(`BTC transaction hash: ${btcTxnHash}`);
    logger.info(`Amount (satoshis): ${amount.toString()}`);
    
    // Validate registry IDs
    if (!RELAYER_REGISTRY_ID) {
      throw new Error("RELAYER_REGISTRY_ID environment variable is not set");
    }
    
    let proofId = await getCollateralProofObject(user);
    if (!proofId) {
      logger.info(`No CollateralProof found. Creating...`);
      proofId = await createCollateralProof(user);
    }

    logger.info(`Running attest_btc_deposit with proofId: ${proofId}`);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::attest_btc_deposit`,
      arguments: [
        tx.object(RELAYER_REGISTRY_ID),
        tx.object(proofId),
        tx.pure(Buffer.from(btcTxnHash, "hex")),
        tx.pure.u64(amount),
      ],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });

    logger.info(`BTC attestation complete! Digest: ${result.digest}`);
    return result.digest;
  } catch (error: any) {
    logger.error(`Error attesting BTC deposit: ${error.message}`);
    throw error;
  }
}
