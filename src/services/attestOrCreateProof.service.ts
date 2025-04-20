import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import dotenv from "dotenv";

dotenv.config();

// Constants
const PACKAGE_ID =
  "0x58fd4af89d8481a971d9458e5410e8952dfbf98f9105060c654757d744efd033";
const MODULE_NAME = "attest_btc_deposit";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const USER_ADDRESS = process.env.USER_ADDRESS!;
const RELAYER_REGISTRY_ID = process.env.RELAYER_REGISTRY_ID!;
const WITNESS_REGISTRY_ID = process.env.WITNESS_REGISTRY_ID!;

const client = new SuiClient({ url: getFullnodeUrl("testnet") });
const keypair = Ed25519Keypair.fromSecretKey(fromBase64(RELAYER_PRIVATE_KEY));

async function getCollateralProofObject(user: string): Promise<string | null> {
  const result = await client.getOwnedObjects({ owner: user });
  const proof = result.data.find((obj) =>
    obj.data?.type?.includes("CollateralProof")
  );
  return proof?.data?.objectId || null;
}

async function createCollateralProof(user: string): Promise<string> {
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

  console.log(`🆕 CollateralProof creation tx digest: ${result.digest}`);

  // Wait and re-fetch
  await new Promise((res) => setTimeout(res, 2000));
  const objectId = await getCollateralProofObject(user);
  if (!objectId)
    throw new Error("❌ Failed to find newly created CollateralProof");
  return objectId;
}

async function attestBtcDeposit(
  user: string,
  btcTxnHash: string,
  amount: bigint
) {
  let proofId = await getCollateralProofObject(user);
  if (!proofId) {
    console.log("⚠️ No CollateralProof found. Creating...");
    proofId = await createCollateralProof(user);
  }

  console.log("📩 Running attest_btc_deposit...");
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

  console.log(`✅ BTC attestation complete! Digest: ${result.digest}`);
}

// Sample
/*
attestBtcDeposit(
  USER_ADDRESS,
  "3a27d218da4e70f27dd197160b1278f056145a316a60af5c41cddb032787b13e",
  BigInt(1000000000) // 1 BTC
).catch(console.error);
*/
