import { randomUUID } from "node:crypto";

import { createDb, heistIntents, wallets } from "@bankroll/db";
import type { CrewId, HeistTier, OutcomeId } from "@bankroll/shared-types";
import { and, eq, isNull } from "drizzle-orm";

import { ensureUserWallet } from "../auth/store.js";
import {
  type HeistPaymentPreparation,
  prepareHeistPaymentTransaction,
} from "./payment.js";

export interface HeistIntentRecord {
  id: string;
  walletAddress: string;
  tier: HeistTier;
  targetId: string;
  crewIds: CrewId[];
  heistCostBaseUnits: bigint;
  idempotencyKey: string;
  status:
    | "intent_created"
    | "payment_pending"
    | "paid"
    | "settlement_selected"
    | "settling"
    | "settled";
  paymentSignature?: string;
  paymentVerifiedAt?: Date;
  outcome?: OutcomeId;
  payoutBaseUnits?: bigint;
  vaultPayoutBaseUnits?: bigint;
  settlementSignature?: string;
  settlementTransactionBase64?: string;
  settledAt?: Date;
  createdAt: Date;
  transactionPreparation: HeistPaymentPreparation;
}

type DbClient = ReturnType<typeof createDb>["db"];

const memoryIntentsById = new Map<string, HeistIntentRecord>();
const memoryIntentsByIdempotencyKey = new Map<string, HeistIntentRecord>();
let cachedDb: DbClient | undefined;

export async function createOrGetHeistIntent(
  input: Omit<
    HeistIntentRecord,
    | "id"
    | "status"
    | "createdAt"
    | "transactionPreparation"
    | "paymentSignature"
    | "paymentVerifiedAt"
  >,
) {
  const transactionPreparation = await prepareHeistPaymentTransaction(input);
  const db = getOptionalDb();

  if (db) {
    const userWallet = await ensureUserWallet(input.walletAddress);
    const [existing] = await db
      .select()
      .from(heistIntents)
      .where(
        and(
          eq(heistIntents.userId, userWallet.userId),
          eq(heistIntents.walletId, userWallet.walletId),
          eq(heistIntents.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (existing) {
      return {
        record: mapDbIntentToRecord(existing, input.walletAddress),
        reused: true,
      };
    }

    const [created] = await db
      .insert(heistIntents)
      .values({
        userId: userWallet.userId,
        walletId: userWallet.walletId,
        idempotencyKey: input.idempotencyKey,
        tier: input.tier,
        targetId: input.targetId,
        crewIds: input.crewIds,
        heistCostBaseUnits: input.heistCostBaseUnits,
        status: transactionPreparation.available
          ? "payment_pending"
          : "intent_created",
        preparedTransactionHash: transactionPreparation.available
          ? transactionPreparation.transactionHash
          : undefined,
        preparedTransactionBase64: transactionPreparation.available
          ? transactionPreparation.transactionBase64
          : undefined,
        paymentRecipientAddress: transactionPreparation.available
          ? transactionPreparation.recipientAddress
          : undefined,
        paymentAsset: transactionPreparation.available
          ? transactionPreparation.asset
          : "SOL",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create heist intent");
    }

    return {
      record: mapDbIntentToRecord(
        created,
        input.walletAddress,
        transactionPreparation,
      ),
      reused: false,
    };
  }

  const scopedIdempotencyKey = buildScopedIdempotencyKey(
    input.walletAddress,
    input.idempotencyKey,
  );
  const existing = memoryIntentsByIdempotencyKey.get(scopedIdempotencyKey);

  if (existing) {
    return {
      record: existing,
      reused: true,
    };
  }

  const record: HeistIntentRecord = {
    ...input,
    id: randomUUID(),
    status: transactionPreparation.available
      ? "payment_pending"
      : "intent_created",
    createdAt: new Date(),
    transactionPreparation,
  };

  memoryIntentsById.set(record.id, record);
  memoryIntentsByIdempotencyKey.set(scopedIdempotencyKey, record);

  return {
    record,
    reused: false,
  };
}

export async function getHeistIntent(id: string) {
  const db = getOptionalDb();

  if (db) {
    const [record] = await db
      .select({
        intent: heistIntents,
        walletAddress: wallets.address,
      })
      .from(heistIntents)
      .innerJoin(wallets, eq(heistIntents.walletId, wallets.id))
      .where(eq(heistIntents.id, id))
      .limit(1);

    if (!record) {
      return undefined;
    }

    return mapDbIntentToRecord(record.intent, record.walletAddress);
  }

  return memoryIntentsById.get(id);
}

export async function markHeistPaymentVerified({
  id,
  paymentSignature,
}: {
  id: string;
  paymentSignature: string;
}) {
  const db = getOptionalDb();
  const paymentVerifiedAt = new Date();

  if (db) {
    const [updated] = await db
      .update(heistIntents)
      .set({
        status: "paid",
        paymentSignature,
        paymentVerifiedAt,
      })
      .where(
        and(
          eq(heistIntents.id, id),
          eq(heistIntents.status, "payment_pending"),
          isNull(heistIntents.paymentSignature),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Heist intent is not waiting for payment");
    }

    const [wallet] = await db
      .select({
        address: wallets.address,
      })
      .from(wallets)
      .where(eq(wallets.id, updated.walletId))
      .limit(1);

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    return mapDbIntentToRecord(updated, wallet.address);
  }

  const record = memoryIntentsById.get(id);

  if (!record) {
    throw new Error("Heist intent not found");
  }

  if (record.status !== "payment_pending" || record.paymentSignature) {
    throw new Error("Heist intent is not waiting for payment");
  }

  for (const existing of memoryIntentsById.values()) {
    if (existing.paymentSignature === paymentSignature) {
      throw new Error("Payment signature already used");
    }
  }

  record.status = "paid";
  record.paymentSignature = paymentSignature;
  record.paymentVerifiedAt = paymentVerifiedAt;
  memoryIntentsById.set(id, record);

  return record;
}

export async function markHeistSettlementSelected({
  id,
  outcome,
  payoutBaseUnits,
  vaultPayoutBaseUnits,
}: {
  id: string;
  outcome: OutcomeId;
  payoutBaseUnits: bigint;
  vaultPayoutBaseUnits: bigint;
}) {
  const db = getOptionalDb();

  if (db) {
    const [updated] = await db
      .update(heistIntents)
      .set({
        status: "settlement_selected",
        outcome,
        payoutBaseUnits,
        vaultPayoutBaseUnits,
      })
      .where(and(eq(heistIntents.id, id), eq(heistIntents.status, "paid")))
      .returning();

    if (!updated) {
      throw new Error("Heist intent is not ready for settlement selection");
    }

    return getMappedDbIntent(updated);
  }

  const record = memoryIntentsById.get(id);

  if (!record || record.status !== "paid") {
    throw new Error("Heist intent is not ready for settlement selection");
  }

  record.status = "settlement_selected";
  record.outcome = outcome;
  record.payoutBaseUnits = payoutBaseUnits;
  record.vaultPayoutBaseUnits = vaultPayoutBaseUnits;
  memoryIntentsById.set(id, record);

  return record;
}

export async function markHeistSettlementSubmitted({
  id,
  settlementSignature,
  settlementTransactionBase64,
}: {
  id: string;
  settlementSignature: string;
  settlementTransactionBase64: string;
}) {
  const db = getOptionalDb();

  if (db) {
    const [updated] = await db
      .update(heistIntents)
      .set({
        status: "settling",
        settlementSignature,
        settlementTransactionBase64,
      })
      .where(
        and(
          eq(heistIntents.id, id),
          eq(heistIntents.status, "settlement_selected"),
          isNull(heistIntents.settlementSignature),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Heist settlement transaction was already submitted");
    }

    return getMappedDbIntent(updated);
  }

  const record = memoryIntentsById.get(id);

  if (
    !record ||
    record.status !== "settlement_selected" ||
    record.settlementSignature
  ) {
    throw new Error("Heist settlement transaction was already submitted");
  }

  record.status = "settling";
  record.settlementSignature = settlementSignature;
  record.settlementTransactionBase64 = settlementTransactionBase64;
  memoryIntentsById.set(id, record);

  return record;
}

export async function markHeistSettled({
  id,
  settlementSignature,
}: {
  id: string;
  settlementSignature?: string;
}) {
  const db = getOptionalDb();
  const settledAt = new Date();

  if (db) {
    const [updated] = await db
      .update(heistIntents)
      .set({
        status: "settled",
        settlementSignature,
        settledAt,
      })
      .where(
        and(
          eq(heistIntents.id, id),
          settlementSignature
            ? eq(heistIntents.settlementSignature, settlementSignature)
            : eq(heistIntents.status, "settlement_selected"),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Heist settlement could not be finalized");
    }

    return getMappedDbIntent(updated);
  }

  const record = memoryIntentsById.get(id);

  if (!record) {
    throw new Error("Heist intent not found");
  }

  if (settlementSignature && record.settlementSignature !== settlementSignature) {
    throw new Error("Heist settlement signature mismatch");
  }

  if (!settlementSignature && record.status !== "settlement_selected") {
    throw new Error("Heist settlement could not be finalized");
  }

  record.status = "settled";
  record.settlementSignature = settlementSignature ?? record.settlementSignature;
  record.settledAt = settledAt;
  memoryIntentsById.set(id, record);

  return record;
}

export function createMemoryHeistForTest(
  input: Omit<HeistIntentRecord, "id" | "createdAt" | "transactionPreparation"> &
    Partial<Pick<HeistIntentRecord, "id" | "createdAt" | "transactionPreparation">>,
) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("createMemoryHeistForTest is only available in tests");
  }

  const record: HeistIntentRecord = {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date(),
    transactionPreparation:
      input.transactionPreparation ??
      ({
        available: false,
        reason: "test fixture",
      } satisfies HeistPaymentPreparation),
  };

  memoryIntentsById.set(record.id, record);
  memoryIntentsByIdempotencyKey.set(
    buildScopedIdempotencyKey(record.walletAddress, record.idempotencyKey),
    record,
  );

  return record;
}

function buildScopedIdempotencyKey(walletAddress: string, idempotencyKey: string) {
  return `${walletAddress}:${idempotencyKey}`;
}

function mapDbIntentToRecord(
  intent: typeof heistIntents.$inferSelect,
  walletAddress: string,
  transactionPreparation?: HeistPaymentPreparation,
): HeistIntentRecord {
  return {
    id: intent.id,
    walletAddress,
    tier: intent.tier,
    targetId: intent.targetId,
    crewIds: intent.crewIds as CrewId[],
    heistCostBaseUnits: intent.heistCostBaseUnits,
    idempotencyKey: intent.idempotencyKey,
    status: intent.status as HeistIntentRecord["status"],
    paymentSignature: intent.paymentSignature ?? undefined,
    paymentVerifiedAt: intent.paymentVerifiedAt ?? undefined,
    outcome: intent.outcome as OutcomeId | undefined,
    payoutBaseUnits: intent.payoutBaseUnits ?? undefined,
    vaultPayoutBaseUnits: intent.vaultPayoutBaseUnits ?? undefined,
    settlementSignature: intent.settlementSignature ?? undefined,
    settlementTransactionBase64: intent.settlementTransactionBase64 ?? undefined,
    settledAt: intent.settledAt ?? undefined,
    createdAt: intent.createdAt,
    transactionPreparation:
      transactionPreparation ?? mapDbTransactionPreparation(intent),
  };
}

async function getMappedDbIntent(intent: typeof heistIntents.$inferSelect) {
  const db = getRequiredDb();
  const [wallet] = await db
    .select({
      address: wallets.address,
    })
    .from(wallets)
    .where(eq(wallets.id, intent.walletId))
    .limit(1);

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  return mapDbIntentToRecord(intent, wallet.address);
}

function mapDbTransactionPreparation(
  intent: typeof heistIntents.$inferSelect,
): HeistPaymentPreparation {
  if (
    intent.preparedTransactionBase64 &&
    intent.preparedTransactionHash &&
    intent.paymentRecipientAddress &&
    intent.paymentAsset
  ) {
    return {
      available: true,
      transactionBase64: intent.preparedTransactionBase64,
      transactionHash: intent.preparedTransactionHash,
      recipientAddress: intent.paymentRecipientAddress,
      asset: "SOL",
      amountBaseUnits: intent.heistCostBaseUnits.toString(),
      latestBlockhash: "stored",
      lastValidBlockHeight: 0,
    };
  }

  return {
    available: false,
    reason: "Native SOL payment transaction preparation is not configured.",
  };
}

function getOptionalDb() {
  if (process.env.NODE_ENV === "test" && !process.env.DATABASE_URL) {
    return undefined;
  }

  return getRequiredDb();
}

function getRequiredDb() {
  if (!cachedDb) {
    cachedDb = createDb().db;
  }

  return cachedDb;
}
