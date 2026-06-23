# Bankroll Mafia Edge Cases

This file tracks edge cases discovered while implementing features from `PLAN.md`.

## Phase 0: Repo Baseline

- Baseline checks can pass while using a globally installed Turbo instead of the repository dependency. This can hide environment differences between machines.
- The repo may contain starter app code that compiles but does not represent the intended product.
- The workspace can be valid even when package names still use starter `@repo/*` identities.

## Phase 1: Package Identity Rename

- App imports and package dependencies must be updated together; otherwise TypeScript may fail to resolve workspace packages.
- The lockfile may continue to contain stale package names until `pnpm install` refreshes workspace metadata.
- Config packages can intentionally remain under `@repo/*` during this phase; only `@repo/ui` is part of the first rename.
- README or planning docs may still mention starter names. These are documentation cleanups, not runtime blockers, unless they conflict with implementation instructions.

## Phase 2: Frontend Foundation

- Tailwind v4 uses the `@tailwindcss/postcss` plugin; older Tailwind config expectations can be wrong for this scaffold.
- shadcn-style aliases require `baseUrl` and `paths` in the app `tsconfig.json`; otherwise `@/components/*` imports fail.
- Radix primitives that use browser state must be client components, even when imported by a server-rendered Next.js page.
- The first heist console is display-only; no frontend value, payout, RTP, or outcome shown here should be treated as authoritative.
- Static demo values can drift from shared economy config once that package exists, so Phase 4 must replace duplicated display constants.
- Long labels such as `Highroller` and currency ranges need responsive grid constraints so tabs and metrics do not overflow on mobile.

## Phase 3: Solana Wallet Frontend

- The broad `@solana/wallet-adapter-wallets` bundle pulled transitive packages with Windows postinstall failures, so the implementation uses narrower Phantom and Solflare adapters.
- `bigint-buffer` may fail to build native bindings on Windows without Visual Studio C++ build tools; install can still succeed using the non-native fallback, but performance may differ.
- Wallet UI must run in a client component; importing wallet hooks or modal buttons directly into server-only code can break SSR.
- The wallet can sign only user-approved transactions. The API can prepare heist transaction data, but it cannot spend user funds.
- `autoConnect` can surface stale wallet state from a previous session, so backend authentication must still verify signed login messages later.
- Devnet/localnet RPC must be environment-driven; hardcoding one cluster can accidentally point tests or demos at the wrong network.

## Phase 4: Shared Economy Packages

- Money values must use integer base units. Native SOL values are stored in lamports; never use floating-point SOL amounts for settlement math.
- Basis-point math floors fractional base units; tests should use values where truncation is expected and understood.
- A vault payout can be capped by pool share, entry multiplier, or remaining daily budget. Tests must cover all three paths before trusting payout safety.
- Crew modifiers can create invalid probability tables if deltas are applied without normalization in later settlement code.
- Duplicate crew IDs are a direct exploit path if repeated perks stack, so economy helpers reject duplicates.
- Static frontend display data will drift from `@bankroll/game-config` until the app imports the shared config directly.
- RTP assertions should check both the tier band and the global repeatable cap; one does not replace the other.

## Phase 5: Backend API Skeleton

- Fastify route modules should be registered with prefixes early so future routes do not collide.
- CORS must allow credentials only for known web origins; wildcard origins with cookies would be unsafe.
- Local cookie secrets are acceptable for development, but production must provide a strong `COOKIE_SECRET`.
- Health checks must not expose sensitive config, vault balances, private keys, or resolver state.
- Module status routes are placeholders and must not be mistaken for implemented business logic.
- The API can coordinate and prepare transactions, but it must never hold a user private key or spend user funds.

## Phase 6: Database And Indexing Foundation

- Postgres is the v1 source of truth for heist state, sessions, indexing, and audit logs. Solana token transfers remain the source of truth for actual value movement.
- Unique constraints must exist for idempotency keys and payment/settlement transaction signatures to prevent duplicate indexing or settlement mirrors.
- Nullable unique settlement signatures can behave differently across databases; Postgres allows multiple nulls, which is acceptable before settlement.
- `snapshotDate` is stored as text for deterministic day buckets, so all writers must agree on UTC date formatting.
- `amount_base_units` columns use bigint mode and must never receive decimal display values.
- Drizzle migrations require `DATABASE_URL`; local defaults are for development only and must not leak into production.
- Auth nonces, sessions, and heist intents are persisted in Postgres outside `NODE_ENV=test`; tests intentionally use a memory adapter to avoid requiring Docker.
- The initial migration is still safe to regenerate only because there is no production data. Once real data exists, schema changes must become forward migrations, not replacement migrations.

## Phase 7: Solana Payment Flow

- Anchor is no longer required for v1. Missing `anchor`, `solana`, `link.exe`, and `cl.exe` block only future custom-program work, not the webapp/API path.
- Direct native SOL transfers make payment verification the critical safety boundary. The API must verify signer, source address, destination address, lamports, slot/confirmation status, and signature uniqueness.
- A submitted transaction signature is not proof of payment by itself; failed, simulated, wrong-recipient, or wrong-amount transactions must not settle.
- Duplicate idempotency keys and duplicate payment signatures must not create multiple paid heists.
- The frontend cannot be trusted to report a successful transfer. The backend must fetch and parse the transaction from RPC.
- Prepared Solana transactions include a recent blockhash and can expire. A reused heist intent may eventually need a refresh-payment endpoint instead of returning stale transaction bytes.
- If the user has insufficient SOL for wager plus fees, wallet submission should fail before settlement.
- RPC confirmation can lag wallet submission. The frontend may need retry/backoff for `/heists/:id/payment` instead of treating the first verification miss as final.
- Devnet SOL is not production SOL. Environment config must make tier recipient addresses explicit per cluster.
- Treasury/vault recipient addresses are public config, but payout authority keypairs are secrets and must never be committed.

## Phase 9: Backend Auth

- Solana wallet connection is not authentication; backend auth requires signing a domain-bound nonce message.
- Nonces must be one-time use. A replayed nonce currently returns an error response and must not create another session.
- In-memory nonce/session stores are acceptable only for this development scaffold. Production must move these records into Postgres or another durable store.
- Invalid signatures must not consume user funds or create sessions, even if the wallet address format is valid.
- Malformed wallet addresses and malformed base58 signatures must return controlled 400/401 responses instead of bubbling into server errors.
- Session cookies are HTTP-only and signed, but local development uses a fallback cookie secret; production must set `COOKIE_SECRET`.
- `autoConnect` frontend state can disagree with backend session state, so `/auth/me` remains the authority for logged-in API access.
- Auth nonce domains must be derived from request metadata such as `Origin`, not caller-submitted JSON, or a malicious client can sign messages for an attacker-chosen domain.
- Derived auth nonce domains still need an allowlist. Non-browser clients can forge headers, so `WEB_ORIGINS` is the authority for acceptable sign-in domains.
- Auth request schemas should be strict. Unknown fields in nonce or verify payloads are suspicious and should fail validation.

## Phase 11: Backend RNG Settlement

- Trusted backend RNG is not trustless or provably fair. It is acceptable for prototype/v1 only under the current plan.
- Randomness tests should verify boundary mapping and table completeness, not claim that random sampling proves fairness.
- Outcome probability totals must equal exactly 10,000 basis points or some rolls become unreachable/undefined.
- Runtime RNG uses cryptographic server randomness, but selected outcomes must be persisted before settlement retries in the future.
- Dev-only roll endpoints must not be available as production gameplay or settlement authority.

## Phase 12: Frontend Heist Flow

- Frontend config display should import `@bankroll/game-config`; duplicated tier/outcome tables drift from backend math.
- Static vault pool display values remain placeholders until `/vaults` is wired to indexed onchain balances.
- Formatting lamports must preserve fractional SOL for low tier values like `0.001 SOL`.
- The UI can preview RTP bands and caps, but it still must not calculate authoritative payouts or outcomes.
- Importing shared types directly from the web app requires an explicit workspace dependency, not just a transitive dependency through game config.
- Wallet connect state and API auth state are separate. A connected wallet still needs message-sign login before protected API calls work.
- Some Solana wallets may not support `signMessage`; the UI must disable backend sign-in instead of assuming every wallet can authenticate.
- API auth uses cookies, so frontend requests must include credentials and backend CORS must allow credentialed requests from the web origin.
- `NEXT_PUBLIC_API_URL` must match the API origin exactly in local and deployed environments, or browser cookie/CORS behavior will look like broken auth.
- Preparing a heist intent is not the same as paying for a heist. Until native SOL transfer preparation exists, the frontend must show that payment preparation is unavailable.
- Generating a new idempotency key per button press is acceptable for manual UI attempts, but retry flows should reuse the same key to avoid duplicate intent records.

## Phase 10: Backend Heist API

- BigInt values cannot be sent as raw JSON, so API responses stringify base-unit amounts.
- The `/heists/intent` route now prepares native SOL payment transactions when `SOLANA_RPC_URL` and the tier vault address are configured.
- Idempotency reuse must return the original intent, not create a second wager attempt.
- Idempotency must be scoped by authenticated wallet. A global idempotency map lets two wallets collide on the same UUID and see/reuse the wrong intent.
- Heist intent validation must reject duplicate crews before any transaction is prepared, otherwise repeated crew perks become an exploit path.
- Vault endpoints currently return static projections until an onchain indexer can read real tier vault SOL balances.
- Heist intent creation must require a verified backend session; wallet auto-connect alone is insufficient authority.
- Intent schemas must be strict. Extra client-submitted fields such as `payoutBaseUnits`, `outcome`, or `vaultPayoutBaseUnits` should fail validation instead of being silently accepted.
- Heist route params must return controlled 400 responses for malformed IDs; parser exceptions should not bubble into generic server errors.

## Phase 11: SOL Settlement

- Settlement must persist the RNG-selected outcome before any payout is attempted. A retry must not reroll the same paid heist.
- Payout transactions must be signed and stored before broadcast. If submission is retried, the backend should resubmit the same signed transaction instead of creating a second payout.
- Paid heists can be user-triggered for settlement in v1, but users must not control outcome, payout, payout address, or settlement signature.
- A matching old SOL transfer must not be usable as payment for a new heist; payment verification checks transaction timing against intent creation.
- Payment transactions missing an RPC `blockTime` cannot prove they happened after the intent and must be rejected when timing checks are required.
- Payment signatures must be globally unique. Reusing a payment signature across heists is a direct double-spend accounting bug.
- Missing `PAYOUT_AUTHORITY_KEYPAIR_PATH` should block settlement, not payment verification.
- This v1 payout path is trusted backend custody. Payout key compromise can drain treasury funds, so production needs key isolation and withdrawal limits.

## Phase 13: Validation And Abuse Tests

- Random Monte Carlo simulations can fail due to variance even when math is correct. Deterministic weighted simulations are better for CI invariants.
- Simulating exactly 10,000 basis-point units represents one complete probability table; multiplying that count gives 10,000+ heists without sampling noise.
- Bot-spam tests should compare total payout against total wagered, not just check the displayed RTP number.
- Vault stress tests must include repeated hits after the daily cap reaches zero; payout should become zero rather than making the vault negative.
- Daily cap exhaustion can make later vault hits pay zero, so the result UI must eventually communicate when a jackpot was budget-capped or converted.
- Highroller vault tests need huge vault pools to prove entry-multiplier caps apply before pool-share payouts can drain too much.

## Phase 14: Devnet Readiness

- Devnet readiness now depends on configured SOL vault addresses and payout authority, not Anchor deployment.
- Tier recipient addresses, RPC URL, API URL, and web URL must be explicit env values; guessing or hardcoding them risks signing against the wrong cluster.
- Payout authority keypair paths should point to local secrets and must not be committed.
- Frontend public env values can expose recipient addresses, but never treasury or payout secrets.
- Trusted-backend v1 is operationally simpler than Anchor, but it increases backend custody/security responsibility.

## Phase 15: Commit Policy

- Local Git hooks cannot be installed until the folder is a Git worktree. The Husky install script exits cleanly when `.git` is missing and installs hooks after clone/init.
- Local hooks are bypassable with `--no-verify`, so GitHub Actions must also check commit messages.
- GitHub Actions only blocks merges if branch protection requires the commit message check.
- Squash merge commit titles must follow the same convention if the repository uses squash merging.
- Product-specific commit types such as `security`, `economy`, and `contract` prevent important game-risk changes from being hidden under generic `chore` commits.
