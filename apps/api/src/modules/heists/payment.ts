import { createHash } from "node:crypto";

import type { HeistTier } from "@bankroll/shared-types";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type ParsedInstruction,
} from "@solana/web3.js";

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
  heistCostBaseUnits,
}: {
  walletAddress: string;
  tier: HeistTier;
  heistCostBaseUnits: bigint;
}): Promise<HeistPaymentPreparation> {
  const config = getPaymentConfig(tier);

  if (!config.ok) {
    return {
      available: false,
      reason: config.error,
    };
  }

  const connection = new Connection(config.value.rpcUrl, "confirmed");
  const fromPubkey = new PublicKey(walletAddress);
  const toPubkey = new PublicKey(config.value.recipientAddress);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: fromPubkey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: heistCostBaseUnits,
    }),
  );
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
    recipientAddress: config.value.recipientAddress,
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
  heistCostBaseUnits,
  notBefore,
}: {
  signature: string;
  walletAddress: string;
  tier: HeistTier;
  heistCostBaseUnits: bigint;
  notBefore?: Date;
}) {
  const config = getPaymentConfig(tier);

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

  const transfer = transaction.transaction.message.instructions.find(
    (instruction): instruction is ParsedInstruction =>
      "parsed" in instruction &&
      instruction.program === "system" &&
      instruction.parsed?.type === "transfer",
  );

  if (!transfer) {
    throw new Error("Payment transaction does not contain a native SOL transfer");
  }

  const info = transfer.parsed.info as {
    source?: string;
    destination?: string;
    lamports?: number;
  };

  if (info.source !== walletAddress) {
    throw new Error("Payment source does not match authenticated wallet");
  }

  if (info.destination !== config.value.recipientAddress) {
    throw new Error("Payment destination does not match tier vault address");
  }

  if (BigInt(info.lamports ?? -1) !== heistCostBaseUnits) {
    throw new Error("Payment amount does not match heist cost");
  }

  return {
    signature,
    slot: transaction.slot,
  };
}

function getPaymentConfig(tier: HeistTier) {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const recipientAddress = process.env[getTierRecipientEnvName(tier)];

  if (!rpcUrl) {
    return {
      ok: false as const,
      error: "SOLANA_RPC_URL is required to prepare heist payments",
    };
  }

  if (!recipientAddress) {
    return {
      ok: false as const,
      error: `${getTierRecipientEnvName(tier)} is required to prepare ${tier} SOL payments`,
    };
  }

  return {
    ok: true as const,
    value: {
      rpcUrl,
      recipientAddress,
    },
  };
}

function getTierRecipientEnvName(tier: HeistTier) {
  switch (tier) {
    case "street":
      return "STREET_VAULT_ADDRESS";
    case "crew":
      return "CREW_VAULT_ADDRESS";
    case "boss":
      return "BOSS_VAULT_ADDRESS";
    case "highroller":
      return "HIGHROLLER_VAULT_ADDRESS";
  }
}
