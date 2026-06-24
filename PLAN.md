# Bankroll Mafia Atomic Execution Plan

## Current Target

Build Bankroll Mafia v1 as a Solana Devnet-first mafia/heist slot game with program-owned vault custody.

Players connect a Solana wallet, choose a tier, choose a target, choose a crew, sign an onchain heist entry transaction with native SOL, and receive one of five outcomes. The frontend sells the mafia fantasy. The Solana program owns tier vaults and enforces custody-sensitive movement. The backend authenticates, indexes, prepares helper transactions, and exposes read APIs.

Core rule:

> Bots can spam because repeatable EV is negative.

## Source Documents

Read these before implementing:

- `AGENTS.md`
- `docs/design/game-loop-mechanics.md`
- `docs/design/system-architecture.md`
- `docs/design/onchain-vault-program.md`

## Hard Decisions Already Made

- Chain: Solana-first.
- Development cluster: Solana Devnet first.
- Asset v1: native SOL.
- Wallet: Solana Wallet Adapter.
- Frontend: Next.js, Tailwind CSS, shadcn/ui, lucide-react, SWR, Zustand.
- Backend: Fastify, PostgreSQL, Drizzle, Zod, Pino.
- Onchain v1 target: one Solana program with four tier vault PDAs.
- Payment model: no user predeposit ledger.
- Custody model v1 target: user signs `enter_heist`; program moves SOL into the tier vault PDA and later pays from that PDA.
- RNG for Devnet: unresolved; acceptable candidates are Solana-compatible VRF/oracle or commit-reveal with timeout/refund.
- Backend hot-wallet payout model: deprecated for serious v1 custody; keep only as historical prototype code until replaced.
- Anchor: used for the Solana program scaffold. Direct `cargo build-sbf` is the reliable native Windows build path right now; `anchor build` still has a Windows toolchain caveat documented in `docs/development/solana-toolchain.md`.
- Package names: `@bankroll/*`.
- No Redis for v1.
- No PvP, dirty cash, energy, cooldowns, free claims, referrals, or hidden RNG nerfs for v1.

## Current Implementation Status

- Solana CLI, Rust, MSVC Build Tools, AVM, and Anchor CLI are installed locally.
- Solana config targets Devnet.
- Initial Anchor program scaffold exists under `programs/bankroll-mafia`.
- Program id: `H8xb7nuoB6uv9V9Eye1c8CWFuefcdDXwLri4VTd1mSyj`.
- Direct SBF build succeeds with `cargo build-sbf --manifest-path programs/bankroll-mafia/Cargo.toml`.
- `anchor build` does not yet pass on native Windows because of an Anchor/AVM/cargo-build-sbf execution issue.
- Implemented onchain instructions so far: `initialize_config`, `initialize_tier_vault`, and `enter_heist`.
- Not implemented yet: onchain settlement, payout logic, RNG reveal, admin withdrawals, reserve accounting, and frontend/API onchain transaction integration.

## Stop Conditions

Stop and report instead of improvising if:

- Node or pnpm tooling is missing and cannot be installed in the environment.
- A dependency requires switching away from Solana Wallet Adapter.
- Any implementation path would describe the system as fully trustless before RNG/admin controls are verifiable and audited.
- Solana CLI or Rust/SBF tooling is required for program build/deploy work and is missing.
- Economy math would make a repeatable heist reach or exceed 100% RTP.
- A settlement path can double-pay, settle twice, pay from the wrong vault, or withdraw reserved vault funds.

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

## Phase 7: Devnet Onchain Program Foundation

1. Install and validate Solana program toolchain.
   - Install Solana CLI.
   - Install Anchor/AVM or choose native Solana Rust explicitly.
   - Run `solana --version`.
   - Run `anchor --version`.
   - Run a direct SBF build.
   - Acceptance: toolchain can build the program locally. Native Windows `anchor build` remains optional until the documented caveat is fixed.

2. Scaffold the Bankroll Mafia program.
   - Preferred location: `programs/bankroll-mafia`.
   - Add program package/workspace files.
   - Add Devnet deploy config.
   - Acceptance: program builds locally and has a generated program id.

3. Implement PDA accounts.
   - Config PDA.
   - Street vault PDA.
   - Crew vault PDA.
   - Boss vault PDA.
   - Highroller vault PDA.
   - Heist PDA per wager.
   - Acceptance: tests derive the same PDAs as `@bankroll/solana`.

4. Implement `initialize_config`.
   - Store admin authority.
   - Store resolver/RNG authority.
   - Store paused flag.
   - Store economy config version or config hash.
   - Acceptance: config cannot be reinitialized by another authority.

5. Implement `initialize_tier_vault`.
   - Initialize tier vault metadata for each tier.
   - Bind each vault to exactly one tier.
   - Store bump and accounting metadata.
   - Acceptance: wrong tier seeds fail.

6. Implement `enter_heist`.
   - Player signs the transaction.
   - Validate tier, cost bounds, four crew IDs, and duplicate crew IDs.
   - Transfer native SOL from player to the tier vault PDA.
   - Create the heist PDA from player and idempotency key hash.
   - Store pending heist state.
   - Acceptance: duplicate idempotency key cannot create a second heist.

7. Implement first settlement path.
   - Use the chosen Devnet RNG path.
   - Verify heist is pending.
   - Calculate payout.
   - Pay from the same tier vault PDA.
   - Mark heist settled.
   - Acceptance: settlement cannot reroll or double-pay.

8. Implement admin controls.
   - Pause/unpause.
   - Admin top-up.
   - Admin withdraw with reserved-payout and safety-buffer checks.
   - Acceptance: admin cannot withdraw funds needed for pending heists.

## Phase 8: Onchain Heist API Integration

1. Add onchain config.
   - Define `BANKROLL_PROGRAM_ID`.
   - Define Devnet RPC URL.
   - Derive tier vault PDAs from `@bankroll/solana`.
   - Acceptance: API refuses onchain heist preparation without explicit program id.

2. Prepare `enter_heist` transaction.
   - Backend validates heist intent.
   - Backend derives the heist PDA and tier vault PDA.
   - Backend returns an unsigned transaction for the user's wallet.
   - Acceptance: frontend wallet can sign and submit `enter_heist`.

3. Index onchain heist state.
   - Store heist PDA, entry signature, tier vault PDA, tier, cost, crew, target, and status.
   - Acceptance: duplicate index attempts are idempotent.

4. Wire frontend to onchain entry flow.
   - Create intent.
   - Sign `enter_heist`.
   - Poll indexed status.
   - Show pending settlement.
   - Acceptance: one Devnet heist can enter onchain from the UI.

5. Wire settlement trigger.
   - Backend may trigger settlement, but program enforces payout rules.
   - Acceptance: backend cannot choose arbitrary payout or move vault funds outside program rules.

## Deprecated Prototype: Direct Solana Payment Flow

This section describes the older trusted-backend prototype and should not be extended for serious v1 custody. Replace it with Phase 7 and Phase 8 work.

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

## Deprecated Prototype: Trusted Backend Settlement

This section describes the older backend hot-wallet payout prototype and should not be extended for serious v1 custody. Program-owned vault settlement supersedes it.

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
   - Derived tier vault PDAs.
   - Admin authority.
   - Resolver/RNG authority.
   - API URL.
   - Web URL.
   - Acceptance: `.env.example` files document all required values.

2. Deploy and initialize Devnet program.
   - Deploy Bankroll Mafia program to Devnet.
   - Initialize config PDA.
   - Initialize all four tier vault PDAs.
   - Fund tier vaults with Devnet SOL for testing.
   - Acceptance: all four vault PDAs are queryable on Devnet.

3. Run devnet smoke test.
   - Connect wallet.
   - Authenticate.
   - Sign `enter_heist`.
   - Confirm heist account exists.
   - Settle heist.
   - Confirm payout came from the correct tier vault PDA.
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
- Mainnet RNG provider.
- Redis.
- Public admin dashboard.

## Open Decisions Before Mainnet

- Legal/compliance review.
- Final production RNG model.
- Final daily vault cap numbers.
- Final RTP values inside tier bands.
- Whether Devnet ships with VRF/oracle randomness or commit-reveal with refund timeout.
- Operational policy for admin and resolver authority custody.
