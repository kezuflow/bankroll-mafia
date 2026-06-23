# Bankroll Mafia System Architecture

## Summary

Bankroll Mafia is a Solana web3 mafia/heist game with a casino-style risk economy. The frontend presents a seamless bank-heist fantasy, while the backend coordinates game intent, payment transaction construction, payment verification, trusted RNG settlement, and payout records. V1 uses direct native SOL transfers and a trusted backend treasury model.

Core architecture rule:

> Frontend previews. Backend coordinates. Wallet signs. Backend verifies payment. Backend settles.

## Tech Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react
- Solana Wallet Adapter
- `@solana/kit` or `@solana/web3.js`
- SWR
- Zustand for local UI/game state only

Tailwind and shadcn/ui should be used for the main product interface. The game should feel like a polished casino/heist dashboard: fast, readable, tactile, and built around repeated play.

### Backend

- Fastify
- TypeScript
- PostgreSQL
- Drizzle ORM
- Drizzle Kit migrations
- Zod validation
- Pino logging
- No Redis for v1

Drizzle is preferred over Prisma for v1 because the backend still needs SQL-like control over indexing, admin records, idempotency, audit logs, and offchain mirrors of onchain events.

### Solana Payments

- Solana Devnet for v1 development
- Native SOL as the settlement asset
- Direct native SOL payment transfers from player wallets
- Tier treasury/vault SOL addresses
- Backend-signed payout transfers
- Trusted backend RNG for prototype/v1

### Later Onchain Program

Anchor is not required for the webapp/API v1. Use it later only if the project decides to move heist state, vault accounting, settlement caps, or payout enforcement into a custom Solana program.

Do not use RainbowKit, wagmi, or viem for the Solana implementation. Those are EVM-oriented tools.

## Monorepo Packages

Use `@bankroll/*` package names for internal packages.

Planned packages:

- `@bankroll/game-config`
- `@bankroll/economy`
- `@bankroll/db`
- `@bankroll/shared-types`
- `@bankroll/ui`

Responsibilities:

- `@bankroll/game-config`: tunable tier, vault, outcome, and crew configuration.
- `@bankroll/economy`: RTP, EV, payout, vault cap, and crew modifier calculations.
- `@bankroll/db`: Drizzle schema, migrations, database client, and indexer/admin repository helpers.
- `@bankroll/shared-types`: API DTOs, shared enums, and cross-app TypeScript types.
- `@bankroll/ui`: reusable design-system components.

## Wallet Connection And Auth

Solana Wallet Adapter is used for wallet connection. It should not be treated as backend authentication by itself.

Use Solana message signing for authentication:

1. Frontend connects wallet with Solana Wallet Adapter.
2. Backend creates a login nonce.
3. Frontend asks the wallet to sign a domain-bound login message.
4. Backend verifies the signature, nonce, domain, wallet address, and expiration.
5. Backend creates a signed HTTP-only session cookie.
6. Game API uses the server session user, not a client-submitted wallet address.

The client may show the connected wallet address, but backend authorization must come from the verified session.

## API Trust Model

All client payloads are untrusted.

The frontend sends intent only:

```json
{
  "tier": "street",
  "targetId": "corner-bank",
  "crewIds": ["driver", "hacker", "lockpick", "lookout"],
  "idempotencyKey": "client-generated-uuid"
}
```

The backend must ignore or reject client-submitted values for:

- wallet ownership
- balance
- payout
- RTP
- vault amount
- outcome
- RNG result
- ledger entries
- treasury allocation

The backend recomputes:

- authenticated user
- wallet ownership
- tier eligibility
- heist cost
- outcome probabilities
- payout amounts
- vault contribution
- treasury allocation
- final settlement records

For onchain heists, the backend cannot spend user funds. It prepares transaction instructions and the user's wallet signs them.

Heist entry flow:

```txt
1. User selects tier, target, crew, and heist cost.
2. Frontend requests a prepared heist payment from the API.
3. Backend validates intent and returns an unsigned native SOL transfer.
4. User signs and submits the transfer with their wallet.
5. Backend verifies the submitted transaction signature against RPC.
6. Backend records the heist as paid.
7. Backend resolves RNG and calculates payout.
8. Backend signs payout from the configured treasury/vault authority.
9. Backend stores the settlement and payout signature.
```

This is no predeposit, but it is a trusted backend treasury model. Do not describe v1 as trustless or non-custodial.

## Backend Modules

Recommended Fastify module layout:

```txt
apps/api/src/modules/
- auth
- wallets
- users
- heists
- vaults
- economy
- ledger
- rng
- treasury
- admin
```

Module responsibilities:

- `auth`: Solana login nonce creation, message signature verification, session cookies, logout.
- `wallets`: wallet ownership, linked wallet records, chain metadata.
- `users`: user profiles, progression, access flags.
- `heists`: heist creation, pending state, settlement orchestration.
- `vaults`: tier vault balances, caps, contributions, payout limits.
- `economy`: server-side RTP and payout calculations.
- `ledger`: indexed mirror of onchain value movement and admin/audit records.
- `rng`: trusted backend RNG resolver for prototype/v1.
- `treasury`: protocol revenue, reserves, burns, and cross-tier seed allocation.
- `admin`: internal tools for balancing, monitoring, and manual review.

## Database Model

Use Solana token transfers as the source of truth for value movement. Use PostgreSQL as the source of truth for offchain sessions, heist state, audit logs, payment verification, settlement records, idempotency, and derived views.

Store money in integer base units:

```txt
amount_base_units BIGINT
```

Do not store money as floating-point values.

Use an append-only indexed ledger mirror for all observed onchain value movement:

```txt
HEIST_ENTRY
NORMAL_PAYOUT
VAULT_PAYOUT
VAULT_CONTRIBUTION
TREASURY_CAPTURE
CROSS_TIER_SEED
REFUND
ADMIN_ADJUSTMENT
```

V1 settlement orchestration should be idempotent:

```txt
1. Create heist intent.
2. Prepare unsigned payment transfer.
3. Verify submitted payment signature.
3. Generate trusted backend RNG outcome.
4. Calculate payout from shared economy config.
5. Persist outcome before payout attempt.
6. Submit payout transfer if payout is greater than zero.
7. Store payout signature and settlement record.
```

The backend/database must enforce one settlement per paid heist so retries cannot double-pay. A later Solana program can move this invariant onchain.

## Data Fetching

Use Next.js Server Components for stable public data where it fits, and SWR for live client-side game state.

Good SWR candidates:

- current vault pool
- connected user profile
- heist history
- pending heist status
- wallet session state
- later leaderboard views

Use Zustand only for local UI state:

- selected crew
- selected tier
- open dialogs
- animation state
- temporary heist builder state

Do not use Zustand as authoritative game state.

## Later Additions

Add only when needed:

- Redis for high-volume rate limiting, queues, or short-lived ephemeral state.
- Worker process for delayed settlement, RNG callbacks, indexing, and retries.
- Chain indexer for contract events.
- Admin dashboard for vaults, treasury, and balancing.
- Observability with metrics, traces, alerts, and settlement anomaly dashboards.
- Provably fair RNG or Solana-compatible VRF once the prototype economy is validated.
- Anchor program for non-custodial vault accounting if the product justifies the added complexity.

## Open Questions

- Should mainnet production keep trusted backend RNG or move to provably fair RNG / Solana-compatible VRF?
- What legal/compliance constraints apply before real-money or crypto wagering goes live?
- Should sessions be stored only in signed cookies for v1, or backed by a database session table?
