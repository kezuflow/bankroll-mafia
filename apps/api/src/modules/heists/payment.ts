import { createHash } from "node:crypto";

import {
  buildEnterHeistTransaction,
  decodeHeistAccount,
  deriveHeistPda,
  deriveTierVaultPda,
  getRequiredProgramIdFromEnv,
  tierSeedBytes,
} from "@bankroll/solana";
import { CREW_IDS, type CrewId, type HeistTier } from "@bankroll/shared-types";
import { Connection, PublicKey } from "@solana/web3.js";

export interface PreparedHeistPayment {
  available: true;
  transactionBase64: string;
  transactionHash: string;
  recipientAddress: string;
  asset: "SOL";
  amountBaseUnits: string;
  latestBlockhash: string;
  lastValidBlockHeight: number;
}

export interface UnavailableHeistPayment {
  available: false;
  reason: string;
}

export type HeistPaymentPreparation =
  | PreparedHeistPayment
  | UnavailableHeistPayment;

export async function prepareHeistPaymentTransaction({
  walletAddress,
  tier,
  targetId,
  crewIds,
  idempotencyKey,
  heistCostBaseUnits,
}: {
  walletAddress: string;
  tier: HeistTier;
  targetId: string;
  crewIds: CrewId[];
  idempotencyKey: string;
  heistCostBaseUnits: bigint;
}): Promise<HeistPaymentPreparation> {
  const config = getProgramPaymentConfig(tier);

  if (!config.ok) {
    return {
      available: false,
      reason: config.error,
    };
  }

  const connection = new Connection(config.value.rpcUrl, "confirmed");
  const player = new PublicKey(walletAddress);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const transaction = buildEnterHeistTransaction({
    programId: config.value.programId,
    player,
    tier,
    idempotencyKey,
    targetIdSeed: hashTargetId(targetId),
    crewIds: encodeCrewIds(crewIds),
    heistCostLamports: heistCostBaseUnits,
    blockhash,
  });
  const transactionBase64 = transaction
    .serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
    .toString("base64");

  return {
    available: true,
    transactionBase64,
    transactionHash: createHash("sha256")
      .update(transactionBase64)
      .digest("hex"),
    recipientAddress: config.value.tierVaultAddress,
    asset: "SOL",
    amountBaseUnits: heistCostBaseUnits.toString(),
    latestBlockhash: blockhash,
    lastValidBlockHeight,
  };
}

export async function verifyHeistPaymentSignature({
  signature,
  walletAddress,
  tier,
  targetId,
  crewIds,
  idempotencyKey,
  heistCostBaseUnits,
  notBefore,
}: {
  signature: string;
  walletAddress: string;
  tier: HeistTier;
  targetId: string;
  crewIds: CrewId[];
  idempotencyKey: string;
  heistCostBaseUnits: bigint;
  notBefore?: Date;
}) {
  const config = getProgramPaymentConfig(tier);

  if (!config.ok) {
    throw new Error(config.error);
  }

  const connection = new Connection(config.value.rpcUrl, "confirmed");
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction) {
    throw new Error("Payment transaction was not found or is not confirmed");
  }

  if (transaction.meta?.err) {
    throw new Error("Payment transaction failed onchain");
  }

  if (notBefore) {
    if (!transaction.blockTime) {
      throw new Error("Payment transaction is missing block time");
    }

    if (transaction.blockTime < Math.floor(notBefore.getTime() / 1000) - 120) {
      throw new Error("Payment transaction predates the heist intent");
    }
  }

  const player = new PublicKey(walletAddress);
  const heistPda = deriveHeistPda({
    programId: config.value.programId,
    walletAddress: player,
    idempotencyKey,
  }).address;
  const hasProgramInstruction =
    transaction.transaction.message.instructions.some((instruction) => {
      if (!("programId" in instruction) || !("accounts" in instruction)) {
        return false;
      }

      return (
        instruction.programId.equals(config.value.programId) &&
        instruction.accounts.some((account) => account.equals(heistPda))
      );
    });

  if (!hasProgramInstruction) {
    throw new Error("Payment transaction does not enter the heist program");
  }

  const payer = transaction.transaction.message.accountKeys.find((account) =>
    account.pubkey.equals(player),
  );

  if (!payer?.signer) {
    throw new Error(
      "Payment transaction was not signed by authenticated wallet",
    );
  }

  const heistAccount = await connection.getAccountInfo(heistPda, "confirmed");

  if (!heistAccount || !heistAccount.owner.equals(config.value.programId)) {
    throw new Error("Heist account was not created by the program");
  }

  const heist = decodeHeistAccount(heistAccount.data);
  assertHeistAccountMatches({
    heist,
    walletAddress,
    tier,
    idempotencyKey,
    targetId,
    crewIds,
    heistCostBaseUnits,
  });

  return {
    signature,
    slot: transaction.slot,
  };
}

function getProgramPaymentConfig(tier: HeistTier) {
  const rpcUrl = process.env.SOLANA_RPC_URL;

  if (!rpcUrl) {
    return {
      ok: false as const,
      error: "SOLANA_RPC_URL is required to prepare heist entry transactions",
    };
  }

  try {
    const programId = getRequiredProgramIdFromEnv(process.env);
    const tierVaultAddress = deriveTierVaultPda({
      programId,
      tier,
    }).address.toBase58();

    return {
      ok: true as const,
      value: {
        rpcUrl,
        programId,
        tierVaultAddress,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "BANKROLL_PROGRAM_ID is required",
    };
  }
}

function encodeCrewIds(crewIds: CrewId[]) {
  return Uint8Array.from(
    crewIds.map((crewId) => {
      const index = CREW_IDS.indexOf(crewId);

      if (index < 0) {
        throw new Error(`Unknown crew id ${crewId}`);
      }

      return index;
    }),
  );
}

function hashTargetId(targetId: string) {
  return createHash("sha256").update(targetId).digest();
}

function uuidSeedBytes(value: string) {
  return Uint8Array.from(Buffer.from(value.replaceAll("-", ""), "hex"));
}

function assertHeistAccountMatches({
  heist,
  walletAddress,
  tier,
  idempotencyKey,
  targetId,
  crewIds,
  heistCostBaseUnits,
}: {
  heist: ReturnType<typeof decodeHeistAccount>;
  walletAddress: string;
  tier: HeistTier;
  idempotencyKey: string;
  targetId: string;
  crewIds: CrewId[];
  heistCostBaseUnits: bigint;
}) {
  if (heist.player.toBase58() !== walletAddress) {
    throw new Error("Heist account player does not match authenticated wallet");
  }

  if (heist.tier !== tierSeedBytes[tier]) {
    throw new Error("Heist account tier does not match intent");
  }

  assertBytes(
    "Heist account idempotency seed",
    heist.idempotencySeed,
    uuidSeedBytes(idempotencyKey),
  );
  assertBytes(
    "Heist account target",
    heist.targetIdSeed,
    hashTargetId(targetId),
  );
  assertBytes("Heist account crew", heist.crewIds, encodeCrewIds(crewIds));

  if (heist.heistCostLamports !== heistCostBaseUnits) {
    throw new Error("Heist account cost does not match intent");
  }

  if (heist.status !== 0) {
    throw new Error("Heist account is not pending settlement");
  }
}

function assertBytes(label: string, actual: Uint8Array, expected: Uint8Array) {
  if (
    actual.length !== expected.length ||
    actual.some((byte, index) => byte !== expected[index])
  ) {
    throw new Error(`${label} does not match intent`);
  }
}
