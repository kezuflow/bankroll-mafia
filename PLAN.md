# Bankroll Mafia Atomic Execution Plan

## Current Target

Build Bankroll Mafia v1 as a Solana-first mafia/heist slot game with a trusted backend settlement model.

Players connect a Solana wallet, choose a tier, choose a target, choose a crew, pay a heist cost with native SOL, and receive one of five outcomes. The frontend sells the mafia fantasy. The backend enforces casino-style RTP, vault caps, settlement rules, audit records, and payout preparation.

Core rule:

> Bots can spam because repeatable EV is negative.

## Source Documents

Read these before implementing:

- `AGENTS.md`
- `docs/design/game-loop-mechanics.md`
- `docs/design/system-architecture.md`

## Hard Decisions Already Made

- Chain: Solana-first.
- Development cluster: start localnet, then Solana Devnet.
- Asset v1: native SOL.
- Wallet: Solana Wallet Adapter.
- Frontend: Next.js, Tailwind CSS, shadcn/ui, lucide-react, SWR, Zustand.
- Backend: Fastify, PostgreSQL, Drizzle, Zod, Pino.
- Onchain v1: direct native SOL transfers, not a custom Anchor program.
- Payment model: no user predeposit ledger.
- Custody model v1: the user signs each heist payment to a treasury/vault SOL address; payouts are sent back from treasury/vault hot wallets by the backend.
- RNG for prototype/v1: trusted backend RNG.
- Smart contracts later: optional Anchor program if traction proves the game loop and custody/settlement should move onchain.
- RNG later: provably fair RNG, commit-reveal, or Solana-compatible VRF.
- Package names: `@bankroll/*`.
- No Redis for v1.
- No PvP, dirty cash, energy, cooldowns, free claims, referrals, or hidden RNG nerfs for v1.

## Stop Conditions

Stop and report instead of improvising if:

- Node or pnpm tooling is missing and cannot be installed in the environment.
- A dependency requires switching away from Solana Wallet Adapter.
- Any implementation path would require custody claims that are stronger than the actual trusted-backend model.
- Economy math would make a repeatable heist reach or exceed 100% RTP.
- A settlement path can double-pay, settle twice, or pay from the wrong vault.

## Phase 0: Repo Baseline

1. Inspect the repo.
   - Run `rg --files`.
   - Read root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, and existing app/package manifests.
   - Acceptance: know the current monorepo shape before editing.

2. Verify current checks.
   - Run `pnpm install` only if dependencies are missing or lockfile is stale.
   - Run `pnpm check-types`.
   - Run `pnpm lint`.
   - Acceptance: record current failures before making changes.

3. Preserve existing user work.
   - Do not reset or delete unrelated files.
   - Do not touch `docs/design/*` unless the task is explicitly documentation-related.

## Phase 1: Rename Internal Package Identity

1. Rename shared package names from `@repo/*` to `@bankroll/*`.
   - Change `packages/ui/package.json` name from `@repo/ui` to `@bankroll/ui`.
   - Update imports in `apps/web` and `apps/docs`.
   - Update app package dependencies.
   - Acceptance: no `@repo/ui` imports remain.

2. Decide whether to keep config packages as `@repo/*` temporarily.
   - Preferred for this phase: leave ESLint and TypeScript config package names unchanged unless renaming them is necessary.
   - Acceptance: app builds are not blocked by cosmetic config-package renames.

3. Run validation.
   - Run `pnpm check-types`.
   - Run `pnpm lint`.

## Phase 2: Frontend Foundation

1. Add Tailwind CSS to `apps/web`.
   - Install Tailwind dependencies compatible with the current Next.js version.
   - Add Tailwind config/postcss config if required by the selected Tailwind version.
   - Update `apps/web/app/globals.css`.
   - Acceptance: `apps/web` renders Tailwind utility classes.

2. Add shadcn/ui conventions.
   - Add `components.json`.
   - Add `apps/web/components/ui` or the repo-preferred equivalent.
   - Add utility helper such as `cn`.
   - Add initial components: `button`, `card`, `badge`, `tabs`, `dialog`, `select`, `sonner` or toast equivalent.
   - Acceptance: local UI components compile and can be imported from the web app.

3. Add lucide-react.
   - Use lucide icons for actions and game UI controls.
   - Acceptance: at least one icon renders in the app.

4. Replace the starter page with a first heist console shell.
   - Show wallet area placeholder.
   - Show tier selector.
   - Show target selector.
   - Show crew picker with the eight crews.
   - Show vault panel.
   - Show heist action button.
   - Do not wire real payments yet.
   - Acceptance: the first screen is the usable heist interface, not a landing page.

5. Run frontend validation.
   - Run `pnpm --filter web check-types`.
   - Run `pnpm --filter web lint`.

## Phase 3: Solana Wallet Frontend

1. Add Solana wallet dependencies.
   - Add Solana Wallet Adapter React packages.
   - Add `@solana/kit` or `@solana/web3.js`.
   - Use native SOL transfers through `@solana/web3.js`.
   - Acceptance: dependencies install without forcing EVM wallet tooling.

2. Add wallet provider.
   - Create a client provider for Solana wallet context.
   - Wrap `apps/web/app/layout.tsx` or a dedicated providers component.
   - Configure localnet/devnet endpoint by environment variable.
   - Acceptance: wallet connection UI can mount without crashing SSR.

3. Add connect/disconnect UI.
   - Replace wallet placeholder with Solana connect button.
   - Show connected public key in shortened form.
   - Acceptance: user can connect a supported browser wallet in dev mode.

4. Add transaction intent placeholder.
   - The heist button should prepare client-side intent only.
   - Do not hardcode private keys or server authority in frontend.
   - Acceptance: frontend sends only tier, target, crew IDs, heist cost, and idempotency key.

## Phase 4: Shared Economy Packages

1. Create `packages/game-config`.
   - Package name: `@bankroll/game-config`.
   - Export tier config, outcome config, crew IDs, target IDs, and vault cap defaults.
   - Acceptance: app imports config from `@bankroll/game-config`.

2. Create `packages/economy`.
   - Package name: `@bankroll/economy`.
   - Export pure functions for:
     - `calculateVaultPayout`
     - `calculateVaultEV`
     - `calculateExpectedPayout`
     - `calculateRtp`
     - `applyCrewModifiers`
     - `assertTierRtpBounds`
   - Acceptance: all functions are deterministic and side-effect free.

3. Create `packages/shared-types`.
   - Package name: `@bankroll/shared-types`.
   - Export shared enums/types for tiers, crews, outcomes, heist intent, and settlement result.
   - Acceptance: frontend and backend can use the same DTO types.

4. Add economy tests.
   - Use Vitest.
   - Test RTP bounds.
   - Test vault caps.
   - Test daily vault cap formula.
   - Test crew modifiers never create 100%+ repeatable RTP.
   - Acceptance: `pnpm test` or package-specific test command passes.

## Phase 5: Backend API Skeleton

1. Create `apps/api`.
   - Fastify app.
   - TypeScript.
   - Pino logger.
   - Zod validation.
   - Health route: `GET /health`.
   - Acceptance: API starts locally and returns healthy status.

2. Add backend modules.
   - Create directories:
     - `auth`
     - `wallets`
     - `users`
     - `heists`
     - `vaults`
     - `economy`
     - `ledger`
     - `rng`
     - `treasury`
     - `admin`
   - Acceptance: modules have route/plugin stubs or clear index files.

3. Add CORS/cookie/security basics.
   - Configure CORS for local web origin.
   - Add signed HTTP-only cookie support.
   - Add helmet or Fastify-compatible security headers where appropriate.
   - Acceptance: web can call API in local dev.

4. Add API scripts to turbo.
   - `dev`, `build`, `lint`, `check-types`.
   - Acceptance: root `pnpm dev` can run web and API tasks.

## Phase 6: Database And Indexing Foundation

1. Create `packages/db`.
   - Package name: `@bankroll/db`.
   - Add Drizzle config.
   - Add Postgres client.
   - Acceptance: package compiles.

2. Add initial schema.
   - Tables:
     - `users`
     - `wallets`
     - `auth_nonces`
     - `sessions` if not using cookie-only sessions
     - `heist_intents`
     - `indexed_heists`
     - `ledger_entries`
     - `vault_snapshots`
     - `rng_settlements`
   - Acceptance: migrations generate cleanly.

3. Add idempotency fields.
   - Heist intent must have user/wallet/idempotency uniqueness.
   - Settlement mirror must uniquely identify the onchain heist account/signature.
   - Acceptance: duplicate API retries cannot create duplicate indexed records.

4. Add local database setup docs or script.
   - Prefer Docker Compose only if needed.
   - Acceptance: a new dev can start Postgres and run migrations.

## Phase 7: Solana Payment Flow

1. Add payment config.
   - Define treasury/vault recipient SOL addresses per cluster and tier.
   - Define settlement asset as native SOL per environment.
   - Keep local/devnet values in `.env.example`; never commit private keys.
   - Acceptance: API refuses to prepare payments without explicit recipient config.

2. Prepare user payment transaction.
   - Backend validates heist intent.
   - Backend returns an unsigned native SOL transfer from the player's wallet to the tier recipient address.
   - Backend stores intent as `payment_pending`.
   - Acceptance: frontend wallet can sign and submit the transfer without exposing private keys.

3. Record payment signature.
   - Frontend submits the transfer signature to the API after wallet send.
   - API stores the signature on the heist intent.
   - Acceptance: duplicate signature or duplicate idempotency key cannot create a second wager.

4. Verify payment before settlement.
   - Backend fetches the transaction from RPC.
   - Verify signer, source address, destination address, lamports, and confirmation status.
   - Mark heist as `paid` only after verification.
   - Acceptance: fake signatures, wrong amount, and wrong recipient fail.

## Phase 8: Trusted Backend Settlement

1. Implement settlement state machine.
   - Allowed states: `created`, `payment_pending`, `paid`, `settling`, `settled`, `failed`, `refunded`.
   - Only `paid` heists can settle.
   - Acceptance: invalid state transitions fail.

2. Generate trusted RNG outcome.
   - Use cryptographically secure server randomness.
   - Persist selected outcome before attempting payout.
   - Reuse the same outcome on retry.
   - Acceptance: payout retries cannot reroll the heist.

3. Calculate payout server-side.
   - Use `@bankroll/economy`.
   - Enforce RTP caps, vault payout formula, max multiplier, and daily vault budget.
   - Acceptance: client-submitted outcome or payout is ignored/rejected.

4. Send payout transaction.
   - Backend signs payout from the configured treasury/vault authority.
   - Store payout signature and final settlement record.
   - Acceptance: double settlement and double payout are impossible through API retries.

5. Add refund path.
   - If payment is verified but settlement fails operationally, allow admin-controlled or automated refund.
   - Acceptance: refund cannot happen after settlement payout.

## Phase 9: Backend Auth

1. Implement Solana login nonce.
   - `POST /auth/nonce`
   - Input: wallet address.
   - Output: nonce and message to sign.
   - Acceptance: nonce is stored with expiration and one-time use.

2. Implement Solana message verification.
   - `POST /auth/verify`
   - Verify signature, message, domain, nonce, wallet address, expiration.
   - Create user/wallet if needed.
   - Set signed HTTP-only session cookie.
   - Acceptance: invalid signatures and replayed nonces fail.

3. Implement session routes.
   - `GET /auth/me`
   - `POST /auth/logout`
   - Acceptance: frontend can show authenticated wallet/user.

## Phase 10: Backend Heist API

1. Implement heist intent route.
   - `POST /heists/intent`
   - Input: tier, targetId, crewIds, heistCost, idempotencyKey.
   - Validate using Zod.
   - Recompute all economy metadata server-side.
   - Acceptance: invalid tier/cost/crew combinations fail.

2. Return prepared Solana transaction data.
   - Include unsigned native SOL transfer for the heist payment.
   - Do not include private keys.
   - Do not let client choose payout or outcome.
   - Acceptance: frontend wallet can sign prepared transaction.

3. Implement heist status route.
   - `GET /heists/:id`
   - Return indexed status, pending/settled outcome, payout, transaction signatures.
   - Acceptance: frontend can poll status with SWR.

4. Implement vault status route.
   - `GET /vaults`
   - Return tier vault balances, caps, daily remaining budget, and display metadata.
   - Acceptance: frontend vault panel uses API data.

## Phase 11: Backend RNG Settlement

1. Implement trusted RNG module.
   - Generate random outcome using cryptographically secure server randomness.
   - Map random value to configured outcome table.
   - Calculate payout using `@bankroll/economy`.
   - Acceptance: distribution tests approximate configured probabilities.

2. Implement settlement worker or command.
   - Find pending indexed heists.
   - Generate outcome.
   - Submit payout transaction from treasury/vault authority when payout is greater than zero.
   - Store settlement audit record.
   - Acceptance: paid heist becomes settled on localnet/devnet.

3. Make settlement idempotent.
   - If transaction submission retries, do not generate a new outcome for the same heist.
   - Store selected outcome before or atomically with submission attempt.
   - Acceptance: retries produce the same settlement.

## Phase 12: Frontend End-To-End Heist

1. Wire heist builder to shared config.
   - Tier selector uses `@bankroll/game-config`.
   - Crew picker uses eight crew definitions.
   - Outcome previews use backend-safe display math only.
   - Acceptance: no duplicated hardcoded economy tables in frontend.

2. Wire wallet-auth flow.
   - Connect wallet.
   - Sign login message.
   - Store session via cookie.
   - Show authenticated state.
   - Acceptance: refresh keeps session if cookie is valid.

3. Wire heist transaction flow.
   - Create intent through API.
   - Wallet signs native SOL payment.
   - Show pending state.
   - Poll status.
   - Show settled result.
   - Acceptance: localnet/devnet end-to-end heist works.

4. Add polished result states.
   - Vault Jackpot.
   - Full Success.
   - Partial Success.
   - Soft Fail.
   - Arrested.
   - Acceptance: each outcome has distinct copy and visual treatment.

## Phase 13: Validation And Abuse Tests

1. Economy simulation.
   - Simulate 10,000+ heists per tier.
   - Confirm observed RTP approaches target range.
   - Confirm bot spam remains negative EV.
   - Acceptance: simulation output is committed or documented.

2. Vault stress tests.
   - Simulate repeated vault hits.
   - Confirm max multiplier cap works.
   - Confirm daily payout cap works.
   - Confirm vault cannot go negative.
   - Acceptance: tests fail if any cap is bypassed.

3. Security tests.
   - Invalid wallet signature.
   - Replayed nonce.
   - Duplicate idempotency key.
   - Tampered payout.
   - Wrong recipient address.
   - Fake payment signature.
   - Double settlement.
   - Acceptance: all attacks fail.

4. Build checks.
   - Run `pnpm check-types`.
   - Run `pnpm lint`.
   - Run package tests.
   - Acceptance: all required checks pass or failures are documented.

## Phase 14: Devnet Readiness

1. Configure devnet environment.
   - RPC URL.
   - Program ID.
   - Tier vault SOL addresses.
   - Resolver authority.
   - API URL.
   - Web URL.
   - Acceptance: `.env.example` files document all required values.

2. Configure treasury and vault SOL addresses.
   - Create/fund devnet recipient wallets.
   - Configure payout authority locally.
   - Acceptance: API can verify incoming payment signatures and send test payouts.

3. Run devnet smoke test.
   - Connect wallet.
   - Authenticate.
   - Sign payment transfer.
   - Settle heist.
   - Confirm payout.
   - Acceptance: one full devnet heist completes from frontend.

## Not In V1

- PvP.
- Dirty cash.
- Laundering.
- Energy.
- Cooldowns.
- Referral rewards.
- Free daily claims.
- Mainnet real-money launch.
- Trustless/provably fair RNG.
- Custom Anchor program.
- Redis.
- Public admin dashboard.

## Open Decisions Before Mainnet

- Legal/compliance review.
- Final production settlement asset.
- Final production RNG model.
- Final daily vault cap numbers.
- Final RTP values inside tier bands.
- Whether/when to migrate settlement and vault accounting into an Anchor program.
- Operational policy for treasury/payout key custody.
