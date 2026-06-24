# Bankroll Mafia System Architecture

## Summary

Bankroll Mafia is a Solana web3 mafia/heist game with a casino-style risk economy. The frontend presents a seamless bank-heist fantasy, while an onchain Solana program owns tier vaults, records paid heists, enforces payout movement, and keeps the backend out of direct custody.

Core architecture rule:

> Frontend previews. Wallet signs. Program escrows and pays. Backend indexes and assists.

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

### Solana Program

- Solana Devnet for v1 development
- Native SOL as the settlement asset
- One Bankroll Mafia Solana program
- Four program-derived tier vault accounts
- One heist state account per wager
- Program-controlled SOL entry and payout movement
- Backend/indexer for UI, auth, read models, and transaction assistance
- Devnet first; no mainnet launch until program, RNG, and operations are audited

Vault structure:

```txt
BankrollMafiaProgram
  config PDA
  street vault PDA
  crew vault PDA
  boss vault PDA
  highroller vault PDA
  heist PDA per wager
```

Do not use backend-controlled payout wallets for the serious v1 custody model. Plain wallets may still be useful for early local smoke tests, but production architecture should use program-owned PDAs.

Do not use RainbowKit, wagmi, or viem for the Solana implementation. Those are EVM-oriented tools.

## Monorepo Packages

Use `@bankroll/*` package names for internal packages.

Planned packages:

- `@bankroll/game-config`
- `@bankroll/economy`
- `@bankroll/db`
- `@bankroll/shared-types`
- `@bankroll/solana`
- `@bankroll/ui`

Responsibilities:

- `@bankroll/game-config`: tunable tier, vault, outcome, and crew configuration.
- `@bankroll/economy`: RTP, EV, payout, vault cap, and crew modifier calculations.
- `@bankroll/db`: Drizzle schema, migrations, database client, and indexer/admin repository helpers.
- `@bankroll/shared-types`: API DTOs, shared enums, and cross-app TypeScript types.
- `@bankroll/solana`: shared Solana constants and PDA derivation helpers.
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

For onchain heists, the backend cannot spend user funds and should not control vault payouts. It may prepare transaction instructions, but the user's wallet signs entry transactions and the program signs vault payouts through PDA authority.

Heist entry flow:

```txt
1. User selects tier, target, crew, and heist cost.
2. Frontend or API builds an enter_heist transaction.
3. User signs and submits enter_heist with their wallet.
4. Program transfers SOL from the player to the correct tier vault PDA.
5. Program creates the heist state account.
6. Backend indexes the confirmed heist account and signature for UI/history.
7. Randomness/settlement resolves through the selected devnet RNG path.
8. Program pays the player from the same tier vault PDA.
9. Backend indexes the settlement and payout signature.
```

This is no predeposit and no backend hot-wallet payout path. Do not describe the game as fully trustless until the RNG and admin controls are also verifiable and audited.

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
- `heists`: heist transaction assistance, indexed status, and pending state read models.
- `vaults`: tier vault balances, caps, contributions, payout limits.
- `economy`: server-side RTP and payout calculations.
- `ledger`: indexed mirror of onchain value movement and admin/audit records.
- `rng`: selected devnet randomness or commit-reveal resolver, with explicit trust limitations.
- `treasury`: protocol revenue, reserves, burns, and cross-tier seed allocation.
- `admin`: internal tools for balancing, monitoring, and manual review.

## Database Model

Use Solana program accounts and transactions as the source of truth for value movement and wager state. Use PostgreSQL as the source of truth for offchain sessions, indexed mirrors, audit logs, idempotency helpers, and derived views.

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

Onchain settlement orchestration should be idempotent:

```txt
1. Derive heist PDA from wallet and idempotency key.
2. enter_heist creates the heist account only once.
3. settle_heist must fail if the heist is already settled.
4. Program calculates or verifies payout from canonical config.
5. Program transfers payout from the tier vault PDA.
6. Backend indexes the final account state and settlement signature.
```

The program must enforce one settlement per paid heist so retries cannot double-pay.

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
- Worker process for delayed settlement triggers, RNG callbacks, indexing, and retries.
- Chain indexer for contract events.
- Admin dashboard for vaults, treasury, and balancing.
- Observability with metrics, traces, alerts, and settlement anomaly dashboards.
- Solana-compatible VRF once the prototype economy is validated, if commit-reveal is not sufficient.

## Open Questions

- Which devnet RNG path should be used first: commit-reveal with refund timeout, Switchboard/MagicBlock style VRF, or another Solana-compatible provider?
- What legal/compliance constraints apply before real-money or crypto wagering goes live?
- Should sessions be stored only in signed cookies for v1, or backed by a database session table?
