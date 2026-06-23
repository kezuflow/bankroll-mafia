# Bankroll Mafia Game Loop Mechanics

## Design Goal

Bankroll Mafia is a slot-style wager disguised as a mafia bank heist.

The player fantasy is mafia strategy: assemble a crew, choose a target, rob the bank, hit the vault, and climb the hierarchy. The economy model is casino-style risk math: every repeatable heist is priced with RTP, expected value, capped jackpot liability, and house edge.

Core principle:

> Bots can spam because repeatable EV is negative.

The game should not rely on energy, cooldowns, dirty cash, PvP, or hidden punishment odds for v1. If a player or bot repeats heists forever, the expected result should be house-edge capture.

V1 is Solana-first:

- Heists are paid onchain with native SOL.
- There is no predeposit ledger.
- The player signs each heist payment as a direct native SOL transfer.
- V1 uses trusted backend payment verification, RNG, vault accounting, and payout settlement.
- A custom Solana/Anchor program is deferred until the game loop proves it is worth the added complexity.

## Core Loop

1. Player chooses a heist tier.
2. Player chooses a target.
3. Player chooses a crew.
4. Player pays the heist cost.
5. Trusted backend RNG resolves one of five outcomes.
6. Player receives the outcome payout.
7. Same-tier vault and treasury allocations update.

The frontend should feel like a mafia heist decision. The backend should treat the action like a wager with capped liability.

## Outcome Table

Use five outcomes so the heist does not feel like a binary win/loss roll.

| Outcome | Baseline Probability | Design Meaning |
| --- | ---: | --- |
| Vault Jackpot | 1% | Crew cracks the main vault and receives the vault payout. |
| Full Success | 39% | Crew completes the job cleanly and receives the main payout. |
| Partial Success | 30% | Crew misses the main score but escapes with a smaller payout. |
| Soft Fail | 20% | Crew escapes with little or no profit. |
| Arrested | 10% | Crew gets caught and receives the worst payout. |

The vault chance is a total probability, not 1% after a success roll.

## RTP Model

Every heist must resolve to a target RTP.

```txt
expectedPayout =
  vaultChance * vaultPayout
+ fullSuccessChance * fullSuccessPayout
+ partialSuccessChance * partialSuccessPayout
+ softFailChance * softFailPayout
+ arrestedChance * arrestedPayout

RTP = expectedPayout / heistCost
houseEdge = 1 - RTP
```

Target RTP bands:

| Tier | Heist Cost | Target RTP | House Edge |
| --- | ---: | ---: | ---: |
| Street | $0.20-$10 | 84%-88% | 12%-16% |
| Crew | $25-$100 | 85%-89% | 11%-15% |
| Boss | $250-$1,000 | 86%-90% | 10%-14% |
| Highroller | $2,500-$10,000 | 87%-91% | 9%-13% |

Hard rules:

- No repeatable crew or target setup may exceed 97% RTP.
- No normal tier should reach 100% RTP.
- 100%+ RTP is only allowed for manually funded, capped, temporary events.
- Crew, target, and vault math must always resolve back into the tier RTP cap.

## Vault Tiers

Each tier has its own vault pool and payout liability.

| Tier | Heist Cost | Vault | Vault Cap |
| --- | ---: | --- | ---: |
| Street | $0.20-$10 | Street Vault | 20x entry |
| Crew | $25-$100 | Crew Vault | 15x entry |
| Boss | $250-$1,000 | Boss Vault | 8x-10x entry |
| Highroller | $2,500-$10,000 | Highroller Vault | 3x-5x entry |

Vault payout formula:

```txt
vaultPayout = min(
  vaultPercent * tierVaultPool,
  maxMultiplier * heistCost,
  dailyTierPayoutCap
)
```

Default values:

```txt
vaultHitChance = 1%
vaultPercent = 1%
```

Vault EV formula:

```txt
vaultEV = vaultHitChance * vaultPayout
```

Example:

```txt
Street heist cost = $10
Street vault = $50,000
vaultHitChance = 1%
vaultPercent = 1%
maxMultiplier = 20x

1% of vault = $500
20x entry cap = $200

vaultPayout = min($500, $200) = $200
vaultEV = 0.01 * $200 = $2
```

If target RTP is 88%, total expected payout on a $10 heist is:

```txt
totalEV = $10 * 0.88 = $8.80
normalOutcomeEV = totalEV - vaultEV
normalOutcomeEV = $8.80 - $2.00 = $6.80
```

If vault EV grows too high, reduce normal payouts or lower the vault cap. The vault should create excitement, not uncontrolled liability.

## Daily Vault Payout Caps

Use daily payout caps. Do not cap only the number of vault hits.

A hit-count cap is easy to understand, but it creates awkward outcomes: one or two tiny hits can consume the daily quota, or a large hit can drain too much if the count is still available. Cap total daily payout amount per tier instead.

Recommended formula:

```txt
dailyTierPayoutCap = min(
  dailyVaultPercent * tierVaultPoolAtDayStart,
  absoluteDailyTierCap
)
```

Recommended launch values:

| Tier | Daily Vault Percent | Absolute Daily Cap |
| --- | ---: | ---: |
| Street | 20% of day-start vault | $2,000 |
| Crew | 15% of day-start vault | $10,000 |
| Boss | 10% of day-start vault | $50,000 |
| Highroller | 5% of day-start vault | $100,000 |

If the daily cap is exhausted, vault outcomes should still resolve, but the payout is capped to the remaining daily vault budget. If the remaining daily budget is zero, the vault outcome should convert to the best non-vault payout profile for that heist.

This cap protects against streak risk while still allowing high-volume play.

## Example Outcome Pricing

Example payout profile for a $10 Street heist at 88% RTP:

```txt
Vault Jackpot:
1% * $200 = $2.00 EV

Full Success:
39% * $12 = $4.68 EV

Partial Success:
30% * $6 = $1.80 EV

Soft Fail:
20% * $1 = $0.20 EV

Arrested:
10% * $1.20 = $0.12 EV

Total EV = $8.80
RTP = 88%
House edge = 12%
```

The payout numbers are tunable. The required invariant is that the final expected payout stays within the tier RTP target.

## Crew Modifiers

Crew selection should change volatility and outcome shape, not guarantee profitability.

Crew roles:

| Crew | Intended Effect | Required Tradeoff |
| --- | --- | --- |
| Driver | Better escape chance and lower arrest chance. | More soft fails or lower upside. |
| Hacker | Better vault odds and cyber/bank target strength. | Lower normal success EV. |
| Insider | Better full-success chance and target weakness reveal. | Lower partial-success or vault EV. |
| Cleaner | Lower evidence/heat fantasy and smoother downside. | No direct top-end boost. |
| Enforcer | Higher payout fantasy. | Higher arrest risk or worse downside. |
| Lockpick | Better partial success and access fantasy. | Lower full-success or jackpot EV. |
| Lookout | Lower police/ambush risk and safer outcomes. | Lower upside. |
| Lawyer | Better arrested outcome. | Does not improve success chance and lowers top-end potential. |

Crew rule:

```txt
crewAdjustedRTP <= tierMaxRTP
```

If a crew combo improves vault EV, compensate by reducing normal outcome EV. If it improves safety, compensate by lowering upside. Do not let one crew combo become mathematically best in every scenario.

## House Edge Allocation

Only allocate money after expected player payouts are priced.

Example $10 Street heist at 88% RTP:

```txt
Entry cost = $10.00
Expected player return = $8.80
House edge = $1.20
```

Example house edge allocation:

```txt
Same-tier vault contribution: $0.30
Cross-tier seed treasury: $0.25
Bankroll reserve: $0.25
Protocol revenue: $0.25
Burn / sink / general treasury: $0.15
```

Rules:

- Same-tier vault contribution supports the current tier vault.
- Cross-tier seed treasury may seed Crew, Boss, or Highroller vaults.
- Street Vault must never directly pay Boss or Highroller jackpots.
- Higher-tier vaults can be seeded from surplus, but their payouts remain capped by their own vault rules.
- Cross-tier seeding is marketing/treasury spend, not player liability.

## Bot / Spam Model

Bots, sybils, and high-volume players are expected.

Normal heist spam is acceptable because repeatable EV is negative.

Example:

```txt
10 bots deposit $20,000 each
Total bankroll = $200,000
They wager full volume through an 88% RTP tier

Expected player return = $176,000
Expected house capture = $24,000
```

Protect the dangerous surfaces:

- No free claims at launch.
- No farmable rewards.
- No referral rewards until sybil controls exist.
- No hidden RNG nerfs for suspicious wallets.
- Use visible limits: tier caps, vault payout caps, event caps, leaderboard restrictions, and max payout rules.

## RNG And Settlement Trust

Never use weak randomness:

- `block.timestamp`
- `blockhash`
- `msg.sender`
- predictable values

V1 uses:

- trusted backend RNG
- backend-verified payment signatures
- backend-signed payout transfers

Later production options:

- verifiable RNG
- commit-reveal
- oracle-based randomness
- delayed reveal

Once a heist payment is verified, the user must not be able to cancel bad outcomes. For V1, the database and backend settlement state machine must enforce one settlement per verified payment. A later Solana program can move this enforcement onchain.

## Later Implementation

After this document stabilizes, extract the tunable numbers into a machine-readable config.

Likely location:

```txt
packages/game-config/src/heistEconomy.ts
```

That config should eventually define:

- tier ranges
- target RTP bounds
- vault hit chance
- vault payout percent
- max multipliers
- base outcome probabilities
- crew modifier rules

## Open Balancing Questions

- What exact target RTP should each tier launch with inside the proposed bands?
- Should daily vault payout caps launch with the recommended values or lower testnet values?
- Should Boss vault cap launch at 8x, 10x, or dynamic by vault size?
- Should Highroller vault cap launch at 3x or 5x?
- How much house edge should be allocated to cross-tier seed treasury versus protocol revenue?
- Should special events ever exceed 100% RTP, or should launch avoid positive-EV events entirely?
