CREATE TYPE "public"."heist_status" AS ENUM('intent_created', 'payment_pending', 'paid', 'settling', 'settlement_selected', 'settled', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."heist_tier" AS ENUM('street', 'crew', 'boss', 'highroller');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('HEIST_ENTRY', 'NORMAL_PAYOUT', 'VAULT_PAYOUT', 'VAULT_CONTRIBUTION', 'TREASURY_CAPTURE', 'CROSS_TIER_SEED', 'REFUND', 'ADMIN_ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"nonce" text NOT NULL,
	"domain" text NOT NULL,
	"message" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heist_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"tier" "heist_tier" NOT NULL,
	"target_id" text NOT NULL,
	"crew_ids" jsonb NOT NULL,
	"heist_cost_base_units" bigint NOT NULL,
	"status" "heist_status" DEFAULT 'intent_created' NOT NULL,
	"prepared_transaction_hash" text,
	"prepared_transaction_base64" text,
	"payment_recipient_address" text,
	"payment_asset" text DEFAULT 'SOL' NOT NULL,
	"payment_signature" text,
	"payment_verified_at" timestamp with time zone,
	"outcome" text,
	"payout_base_units" bigint,
	"vault_payout_base_units" bigint,
	"settlement_signature" text,
	"settlement_transaction_base64" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexed_heists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"heist_intent_id" uuid,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"payment_signature" text NOT NULL,
	"settle_signature" text,
	"tier" "heist_tier" NOT NULL,
	"status" "heist_status" DEFAULT 'payment_pending' NOT NULL,
	"outcome" text,
	"payout_base_units" bigint,
	"vault_payout_base_units" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indexed_heist_id" uuid,
	"type" "ledger_entry_type" NOT NULL,
	"tier" "heist_tier",
	"wallet_address" text,
	"amount_base_units" bigint NOT NULL,
	"transaction_signature" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rng_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indexed_heist_id" uuid NOT NULL,
	"rng_authority" text NOT NULL,
	"random_seed_hash" text NOT NULL,
	"outcome" text NOT NULL,
	"payout_base_units" bigint NOT NULL,
	"submitted_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "heist_tier" NOT NULL,
	"vault_address" text NOT NULL,
	"balance_base_units" bigint NOT NULL,
	"daily_payout_cap_base_units" bigint NOT NULL,
	"daily_payout_used_base_units" bigint NOT NULL,
	"snapshot_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" text NOT NULL,
	"chain" text DEFAULT 'solana' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "heist_intents" ADD CONSTRAINT "heist_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heist_intents" ADD CONSTRAINT "heist_intents_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexed_heists" ADD CONSTRAINT "indexed_heists_heist_intent_id_heist_intents_id_fk" FOREIGN KEY ("heist_intent_id") REFERENCES "public"."heist_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexed_heists" ADD CONSTRAINT "indexed_heists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexed_heists" ADD CONSTRAINT "indexed_heists_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_indexed_heist_id_indexed_heists_id_fk" FOREIGN KEY ("indexed_heist_id") REFERENCES "public"."indexed_heists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rng_settlements" ADD CONSTRAINT "rng_settlements_indexed_heist_id_indexed_heists_id_fk" FOREIGN KEY ("indexed_heist_id") REFERENCES "public"."indexed_heists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_nonces_nonce_unique" ON "auth_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "auth_nonces_wallet_address_idx" ON "auth_nonces" USING btree ("wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "heist_intents_user_wallet_idempotency_unique" ON "heist_intents" USING btree ("user_id","wallet_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "heist_intents_payment_signature_unique" ON "heist_intents" USING btree ("payment_signature");--> statement-breakpoint
CREATE UNIQUE INDEX "heist_intents_settlement_signature_unique" ON "heist_intents" USING btree ("settlement_signature");--> statement-breakpoint
CREATE UNIQUE INDEX "indexed_heists_payment_signature_unique" ON "indexed_heists" USING btree ("payment_signature");--> statement-breakpoint
CREATE UNIQUE INDEX "indexed_heists_settle_signature_unique" ON "indexed_heists" USING btree ("settle_signature");--> statement-breakpoint
CREATE INDEX "indexed_heists_user_id_idx" ON "indexed_heists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "indexed_heists_status_idx" ON "indexed_heists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_entries_indexed_heist_id_idx" ON "ledger_entries" USING btree ("indexed_heist_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_signature_idx" ON "ledger_entries" USING btree ("transaction_signature");--> statement-breakpoint
CREATE UNIQUE INDEX "rng_settlements_indexed_heist_unique" ON "rng_settlements" USING btree ("indexed_heist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rng_settlements_signature_unique" ON "rng_settlements" USING btree ("submitted_signature");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_snapshots_tier_date_unique" ON "vault_snapshots" USING btree ("tier","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_address_unique" ON "wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");