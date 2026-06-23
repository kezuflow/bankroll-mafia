# Commit Convention

Bankroll Mafia uses Conventional Commits enforced by Commitlint.

## Format

```txt
type(scope): subject
```

The scope is optional but recommended.

## Allowed Types

- `feat`: player-facing feature
- `fix`: bug fix
- `security`: security hardening or abuse-prevention change
- `economy`: economy, RTP, vault, or payout math change
- `contract`: smart contract or onchain integration change
- `docs`: documentation-only change
- `test`: test-only change
- `refactor`: code change with no intended behavior change
- `perf`: performance improvement
- `build`: build system or dependency change
- `ci`: CI workflow change
- `chore`: maintenance change
- `style`: formatting-only change
- `revert`: revert commit

## Examples

```txt
feat(web): add heist preparation flow
security(api): reject reused payment signatures
economy(config): tune street vault payout cap
contract(solana): add devnet heist settlement instruction
docs(plan): document commit naming policy
```

## Enforcement

Local commits are checked by the Husky `commit-msg` hook.
Pull request commits and direct pushes to `main` are checked by GitHub Actions.

After cloning the repo, run:

```txt
pnpm install
```

Husky will install the local Git hook automatically when `.git` exists.
