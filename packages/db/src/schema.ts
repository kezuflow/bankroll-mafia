import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const heistTierEnum = pgEnum("heist_tier", [
  "street",
  "crew",
  "boss",
  "highroller",
]);

export const heistStatusEnum = pgEnum("heist_status", [
  "intent_created",
  "payment_pending",
  "paid",
  "settling",
  "settlement_selected",
  "settled",
  "failed",
  "refunded",
]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "HEIST_ENTRY",
  "NORMAL_PAYOUT",
  "VAULT_PAYOUT",
  "VAULT_CONTRIBUTION",
  "TREASURY_CAPTURE",
  "CROSS_TIER_SEED",
  "REFUND",
  "ADMIN_ADJUSTMENT",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    address: text("address").notNull(),
    chain: text("chain").notNull().default("solana"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    addressIdx: uniqueIndex("wallets_address_unique").on(table.address),
    userIdx: index("wallets_user_id_idx").on(table.userId),
  }),
);

export const authNonces = pgTable(
  "auth_nonces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    nonce: text("nonce").notNull(),
    domain: text("domain").notNull(),
    message: text("message").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nonceIdx: uniqueIndex("auth_nonces_nonce_unique").on(table.nonce),
    walletIdx: index("auth_nonces_wallet_address_idx").on(table.walletAddress),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_hash_unique").on(
      table.sessionTokenHash,
    ),
    userIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);

export const heistIntents = pgTable(
  "heist_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    idempotencyKey: text("idempotency_key").notNull(),
    tier: heistTierEnum("tier").notNull(),
    targetId: text("target_id").notNull(),
    crewIds: jsonb("crew_ids").$type<string[]>().notNull(),
    heistCostBaseUnits: bigint("heist_cost_base_units", {
      mode: "bigint",
    }).notNull(),
    status: heistStatusEnum("status").notNull().default("intent_created"),
    preparedTransactionHash: text("prepared_transaction_hash"),
    preparedTransactionBase64: text("prepared_transaction_base64"),
    paymentRecipientAddress: text("payment_recipient_address"),
    paymentAsset: text("payment_asset").notNull().default("SOL"),
    paymentSignature: text("payment_signature"),
    paymentVerifiedAt: timestamp("payment_verified_at", { withTimezone: true }),
    outcome: text("outcome"),
    payoutBaseUnits: bigint("payout_base_units", { mode: "bigint" }),
    vaultPayoutBaseUnits: bigint("vault_payout_base_units", { mode: "bigint" }),
    settlementSignature: text("settlement_signature"),
    settlementTransactionBase64: text("settlement_transaction_base64"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("heist_intents_user_wallet_idempotency_unique").on(
      table.userId,
      table.walletId,
      table.idempotencyKey,
    ),
    paymentSignatureIdx: uniqueIndex("heist_intents_payment_signature_unique").on(
      table.paymentSignature,
    ),
    settlementSignatureIdx: uniqueIndex(
      "heist_intents_settlement_signature_unique",
    ).on(table.settlementSignature),
  }),
);

export const indexedHeists = pgTable(
  "indexed_heists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    heistIntentId: uuid("heist_intent_id").references(() => heistIntents.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    paymentSignature: text("payment_signature").notNull(),
    settleSignature: text("settle_signature"),
    tier: heistTierEnum("tier").notNull(),
    status: heistStatusEnum("status").notNull().default("payment_pending"),
    outcome: text("outcome"),
    payoutBaseUnits: bigint("payout_base_units", { mode: "bigint" }),
    vaultPayoutBaseUnits: bigint("vault_payout_base_units", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => ({
    paymentSignatureIdx: uniqueIndex("indexed_heists_payment_signature_unique").on(
      table.paymentSignature,
    ),
    settleSignatureIdx: uniqueIndex("indexed_heists_settle_signature_unique").on(
      table.settleSignature,
    ),
    userIdx: index("indexed_heists_user_id_idx").on(table.userId),
    statusIdx: index("indexed_heists_status_idx").on(table.status),
  }),
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    indexedHeistId: uuid("indexed_heist_id").references(() => indexedHeists.id),
    type: ledgerEntryTypeEnum("type").notNull(),
    tier: heistTierEnum("tier"),
    walletAddress: text("wallet_address"),
    amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
    transactionSignature: text("transaction_signature"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    heistIdx: index("ledger_entries_indexed_heist_id_idx").on(
      table.indexedHeistId,
    ),
    signatureIdx: index("ledger_entries_transaction_signature_idx").on(
      table.transactionSignature,
    ),
  }),
);

export const vaultSnapshots = pgTable(
  "vault_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tier: heistTierEnum("tier").notNull(),
    vaultAddress: text("vault_address").notNull(),
    balanceBaseUnits: bigint("balance_base_units", { mode: "bigint" }).notNull(),
    dailyPayoutCapBaseUnits: bigint("daily_payout_cap_base_units", {
      mode: "bigint",
    }).notNull(),
    dailyPayoutUsedBaseUnits: bigint("daily_payout_used_base_units", {
      mode: "bigint",
    }).notNull(),
    snapshotDate: text("snapshot_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tierDateIdx: uniqueIndex("vault_snapshots_tier_date_unique").on(
      table.tier,
      table.snapshotDate,
    ),
  }),
);

export const rngSettlements = pgTable(
  "rng_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    indexedHeistId: uuid("indexed_heist_id")
      .notNull()
      .references(() => indexedHeists.id),
    rngAuthority: text("rng_authority").notNull(),
    randomSeedHash: text("random_seed_hash").notNull(),
    outcome: text("outcome").notNull(),
    payoutBaseUnits: bigint("payout_base_units", { mode: "bigint" }).notNull(),
    submittedSignature: text("submitted_signature"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    heistIdx: uniqueIndex("rng_settlements_indexed_heist_unique").on(
      table.indexedHeistId,
    ),
    signatureIdx: uniqueIndex("rng_settlements_signature_unique").on(
      table.submittedSignature,
    ),
  }),
);

export const schema = {
  authNonces,
  heistIntents,
  indexedHeists,
  ledgerEntries,
  rngSettlements,
  sessions,
  users,
  vaultSnapshots,
  wallets,
};
