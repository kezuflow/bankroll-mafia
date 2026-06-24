import { readFile } from "node:fs/promises";

import { SOL, tierConfigs, type TierConfig } from "@bankroll/game-config";
import { calculateVaultPayout, multiplyBasisPoints } from "@bankroll/economy";
import {
  buildSettleHeistInstruction,
  getRequiredProgramIdFromEnv,
} from "@bankroll/solana";
import type { OutcomeId } from "@bankroll/shared-types";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  sendAndConfirmRawTransaction,
  Transaction,
} from "@solana/web3.js";

import { generateTrustedOutcome } from "../rng/service.js";
import {
  getHeistIntent,
  markHeistSettled,
  markHeistSettlementSelected,
  markHeistSettlementSubmitted,
  type HeistIntentRecord,
} from "./store.js";

const normalOutcomeMultipliersBasisPoints = {
  full_success: 12_000,
  partial_success: 6_000,
  soft_fail: 1_000,
  arrested: 0,
} satisfies Partial<Record<OutcomeId, number>>;

const outcomeProgramIds = {
  vault_jackpot: 0,
  full_success: 1,
  partial_success: 2,
  soft_fail: 3,
  arrested: 4,
} satisfies Record<OutcomeId, number>;

export interface SettlementTransport {
  buildSignedSettlement(input: HeistIntentRecord): Promise<{
    signature: string;
    transactionBase64: string;
  }>;
  submitSignedSettlement(transactionBase64: string): Promise<string>;
}

export async function settleHeistIntent({
  heistId,
  transport = createSolSettlementTransport(),
}: {
  heistId: string;
  transport?: SettlementTransport;
}) {
  const existing = await getHeistIntent(heistId);

  if (!existing) {
    throw new Error("Heist intent not found");
  }

  if (existing.status === "settled") {
    return existing;
  }

  if (
    existing.status !== "paid" &&
    existing.status !== "settlement_selected" &&
    existing.status !== "settling"
  ) {
    throw new Error("Only paid heists can be settled");
  }

  const selected =
    existing.status === "paid"
      ? await selectSettlementOutcome(heistId)
      : existing;

  if (selected.payoutBaseUnits === undefined) {
    throw new Error("Settlement payout was not selected");
  }

  if (selected.payoutBaseUnits === 0n) {
    return markHeistSettled({
      id: selected.id,
    });
  }

  const submitted =
    selected.status === "settling" &&
    selected.settlementSignature &&
    selected.settlementTransactionBase64
      ? selected
      : await buildAndStorePayoutTransaction(selected.id, transport);

  if (!submitted.settlementTransactionBase64) {
    throw new Error("Settlement transaction was not stored");
  }

  const signature = await transport.submitSignedSettlement(
    submitted.settlementTransactionBase64,
  );

  if (
    submitted.settlementSignature &&
    signature !== submitted.settlementSignature
  ) {
    throw new Error("Submitted settlement signature changed during retry");
  }

  return markHeistSettled({
    id: submitted.id,
    settlementSignature: signature,
  });
}

export function calculateSettlementPayout({
  outcome,
  heistCostBaseUnits,
  tierConfig,
  vaultPoolBaseUnits,
  remainingDailyVaultCapBaseUnits,
}: {
  outcome: OutcomeId;
  heistCostBaseUnits: bigint;
  tierConfig: TierConfig;
  vaultPoolBaseUnits: bigint;
  remainingDailyVaultCapBaseUnits: bigint;
}) {
  if (outcome === "vault_jackpot") {
    const payoutBaseUnits = calculateVaultPayout({
      tierVaultPoolBaseUnits: vaultPoolBaseUnits,
      heistCostBaseUnits,
      vaultPercentBasisPoints: 100,
      maxMultiplierBasisPoints: tierConfig.vaultMaxMultiplierBasisPoints,
      remainingDailyPayoutCapBaseUnits: remainingDailyVaultCapBaseUnits,
    });

    return {
      payoutBaseUnits,
      vaultPayoutBaseUnits: payoutBaseUnits,
    };
  }

  return {
    payoutBaseUnits: multiplyBasisPoints(
      heistCostBaseUnits,
      normalOutcomeMultipliersBasisPoints[outcome] ?? 0,
    ),
    vaultPayoutBaseUnits: 0n,
  };
}

function createSolSettlementTransport(): SettlementTransport {
  return {
    async buildSignedSettlement(input) {
      if (!input.outcome) {
        throw new Error("Settlement outcome was not selected");
      }

      if (input.payoutBaseUnits === undefined) {
        throw new Error("Settlement payout was not selected");
      }

      const { connection, payoutAuthority, programId } =
        await getSettlementRuntime();
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: payoutAuthority.publicKey,
        recentBlockhash: blockhash,
      }).add(
        buildSettleHeistInstruction({
          programId,
          player: input.walletAddress,
          resolverAuthority: payoutAuthority.publicKey,
          tier: input.tier,
          idempotencyKey: input.idempotencyKey,
          outcome: outcomeProgramIds[input.outcome],
          payoutLamports: input.payoutBaseUnits,
        }),
      );

      transaction.sign(payoutAuthority);

      if (!transaction.signature) {
        throw new Error("Failed to sign settlement transaction");
      }

      return {
        signature: bs58Signature(transaction.signature),
        transactionBase64: transaction.serialize().toString("base64"),
      };
    },
    async submitSignedSettlement(transactionBase64) {
      const { connection } = await getSettlementRuntime();
      const rawTransaction = Buffer.from(transactionBase64, "base64");
      const transaction = Transaction.from(rawTransaction);
      const signature = transaction.signature;

      if (!signature) {
        throw new Error("Stored settlement transaction is not signed");
      }

      await sendAndConfirmRawTransaction(connection, rawTransaction, {
        commitment: "confirmed",
      });

      return bs58Signature(signature);
    },
  };
}

async function selectSettlementOutcome(heistId: string) {
  const heist = await getHeistIntent(heistId);

  if (!heist) {
    throw new Error("Heist intent not found");
  }

  const tierConfig = tierConfigs.find((tier) => tier.id === heist.tier);

  if (!tierConfig) {
    throw new Error("Tier config not found");
  }

  const rng = generateTrustedOutcome();
  const payout = calculateSettlementPayout({
    outcome: rng.outcome,
    heistCostBaseUnits: heist.heistCostBaseUnits,
    tierConfig,
    vaultPoolBaseUnits: getConfiguredVaultPoolFallback(heist.tier),
    remainingDailyVaultCapBaseUnits: tierConfig.absoluteDailyVaultCapBaseUnits,
  });

  return markHeistSettlementSelected({
    id: heist.id,
    outcome: rng.outcome,
    payoutBaseUnits: payout.payoutBaseUnits,
    vaultPayoutBaseUnits: payout.vaultPayoutBaseUnits,
  });
}

async function buildAndStorePayoutTransaction(
  heistId: string,
  transport: SettlementTransport,
) {
  const selected = await getHeistIntent(heistId);

  if (!selected) {
    throw new Error("Heist intent not found");
  }

  if (selected.payoutBaseUnits === undefined) {
    throw new Error("Settlement payout was not selected");
  }

  const signed = await transport.buildSignedSettlement(selected);

  return markHeistSettlementSubmitted({
    id: selected.id,
    settlementSignature: signed.signature,
    settlementTransactionBase64: signed.transactionBase64,
  });
}

async function getSettlementRuntime() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const keypairPath = process.env.PAYOUT_AUTHORITY_KEYPAIR_PATH;

  if (!rpcUrl) {
    throw new Error("SOLANA_RPC_URL is required to settle heists");
  }

  if (!keypairPath) {
    throw new Error(
      "PAYOUT_AUTHORITY_KEYPAIR_PATH is required to settle heists",
    );
  }

  return {
    connection: new Connection(rpcUrl, "confirmed"),
    payoutAuthority: await loadKeypairFromFile(keypairPath),
    programId: getRequiredProgramIdFromEnv(process.env),
  };
}

async function loadKeypairFromFile(path: string) {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (
    !Array.isArray(parsed) ||
    parsed.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    throw new Error(
      "Payout authority keypair file must be a Solana byte array",
    );
  }

  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

function getConfiguredVaultPoolFallback(tier: TierConfig["id"]) {
  switch (tier) {
    case "street":
      return 100n * SOL;
    case "crew":
      return 500n * SOL;
    case "boss":
      return 2_500n * SOL;
    case "highroller":
      return 10_000n * SOL;
  }
}

function bs58Signature(signature: Buffer | Uint8Array) {
  return bs58.encode(signature);
}
