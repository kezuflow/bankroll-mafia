# Bankroll Mafia Onchain Vault Program

## Decision

V1 custody should use one Solana program with four tier vault PDAs on Devnet.

```txt
BankrollMafiaProgram
  config PDA
  street vault PDA
  crew vault PDA
  boss vault PDA
  highroller vault PDA
  heist PDA per wager
```

This replaces the earlier trusted-backend payout-wallet model as the target architecture.

## Why This Is Safer

Program-derived addresses have no private key. Vault funds can move only through program instructions signed with PDA seeds by the Bankroll Mafia program. That is safer than backend-controlled hot wallets because a compromised API keypair should not be able to drain vaults directly.

This does not automatically solve randomness. RNG remains a separate security boundary.

## Devnet Scope

Development starts on Solana Devnet.

Required environment:

```txt
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
BANKROLL_PROGRAM_ID=<deployed devnet program id>
```

No mainnet deployment should happen until the program, RNG path, admin controls, and treasury operations are reviewed.

## PDA Seeds

Shared seed constants live in `@bankroll/solana`.

```txt
config PDA seeds:
  ["config"]

tier vault PDA seeds:
  ["vault", tier_byte]

tier byte mapping:
  street = 0
  crew = 1
  boss = 2
  highroller = 3

heist PDA seeds:
  ["heist", player_pubkey, uuid_bytes(idempotency_key)]
```

The idempotency key is encoded as 16 UUID bytes so the seed format is deterministic and Solana seed-size safe.

## Program Accounts

### Config

Stores global authority and game parameters:

- admin authority
- resolver authority or RNG authority
- treasury authority for allowed withdrawals
- paused flag
- active economy config version

### Tier Vault

One account per tier:

- tier id
- bump
- vault accounting metadata
- daily payout cap state
- payout reserved amount
- total deposits
- total payouts

The SOL balance lives at the PDA address.

### Heist

One account per wager:

- player
- tier
- target id
- crew ids
- heist cost in lamports
- status
- idempotency hash
- created slot
- selected outcome
- payout lamports
- settlement signature marker

## Instructions

### initialize_config

Creates the program config account and stores admin/resolver authorities.

The initializer must be the current upgrade authority for the deployed program. This prevents a random wallet from front-running first config initialization and becoming admin.

### initialize_tier_vault

Creates or initializes the PDA metadata for a tier vault.

This instruction must be signed by the admin stored in the config PDA. Random wallets should not be able to pre-initialize or grief tier vault metadata.

### enter_heist

Player-signed instruction that:

1. Validates tier, cost, crew count, and duplicate crews.
2. Transfers SOL from player to the tier vault PDA.
3. Creates the heist PDA.
4. Stores the pending heist state.

### settle_heist

Resolver-signed instruction that:

1. Verifies the heist is unsettled.
2. Accepts the resolver-selected outcome and payout for the current Devnet scaffold.
3. Enforces the tier payout multiplier cap.
4. Verifies the tier vault has enough SOL above rent-exempt balance.
5. Transfers payout from tier vault PDA to player.
6. Marks the heist settled.

The current Devnet scaffold does not yet verify VRF or commit-reveal proof inside the program. That remains a required security upgrade before real-value launch.

### admin_top_up

Allows anyone or an admin wallet to transfer SOL into a tier vault. Top-ups increase available bankroll after confirmation.

### admin_withdraw

Admin-signed instruction that withdraws only:

```txt
withdrawable = vault_balance - reserved_pending_payouts - safety_buffer
```

Withdrawals must fail if they would make pending heists insolvent.

### pause / unpause

Admin safety control. Pause should block new heists and optionally allow settlement/refunds.

## Randomness Options

Do not use slot, timestamp, recent blockhash, or wallet address as casino RNG.

Acceptable Devnet options:

- Solana-compatible VRF/oracle provider.
- Commit-reveal with a forced refund path if the resolver refuses to reveal.

Commit-reveal is less trustless because the resolver can grief by not revealing. It must include timeout/refund rules before being used with real value.

## Backend Role

The backend should:

- authenticate users for the web app
- prepare or help build transactions
- index program accounts and signatures
- expose read APIs for UI
- trigger settlement transactions when needed
- monitor vault health and anomalies

The backend should not:

- directly custody vault funds
- sign arbitrary payouts from a hot wallet
- accept client-submitted payout/outcome data
- override program settlement rules

## Open Program Questions

- Which RNG provider/path ships first on Devnet?
- Should economy config be fully onchain or versioned offchain with a config hash?
- How large should the safety buffer be per tier?
- Should admin withdrawals be timelocked even on Devnet?
- Should settlement be permissioned to a resolver or permissionless after randomness is available?
