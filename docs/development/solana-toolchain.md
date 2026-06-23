# Solana And Anchor Toolchain Setup

The current v1 plan does not require Anchor. This document is kept only for the later custom-program workstream if the project decides to move vault accounting or settlement enforcement into an Anchor program.

Required commands:

```sh
solana --version
anchor --version
rustc --version
cargo --version
```

Current Windows blocker observed in this workspace:

```txt
anchor: command not found
solana: command not found
cargo install avm failed because link.exe was not found
```

Rust/Cargo are available, but this Windows Rust target needs the MSVC linker from Visual Studio Build Tools.

## Recommended Windows Path

Use the official Solana Windows/WSL setup path:

- https://solana.com/docs/intro/installation
- https://solana.com/docs/intro/installation/dependencies

For native Windows Rust builds, install Visual Studio Build Tools with the C++ workload so `link.exe` and `cl.exe` are available.

After MSVC tools are available, install Anchor Version Manager:

```sh
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm --version
avm install latest
avm use latest
anchor --version
```

Install Solana CLI using the official Solana/Anza instructions:

- https://solana.com/docs/intro/installation
- https://docs.anza.xyz/cli/install

## Validation Before Resuming Future Anchor Work

Do not scaffold or claim Anchor program completion until these pass:

```sh
solana --version
anchor --version
anchor init anchor-smoke-test
cd anchor-smoke-test
anchor build
```

Once the smoke test succeeds, create a separate Anchor implementation plan before adding program files to this repo.

## Devnet Values Needed Later

If a custom program is added later, fill these values in local env files:

```txt
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
BANKROLL_PROGRAM_ID=<deployed program id>
PAYOUT_AUTHORITY_KEYPAIR_PATH=<local payout authority keypair path>
STREET_VAULT_ADDRESS=<street vault SOL address>
CREW_VAULT_ADDRESS=<crew vault SOL address>
BOSS_VAULT_ADDRESS=<boss vault SOL address>
HIGHROLLER_VAULT_ADDRESS=<highroller vault SOL address>
```

Do not use production/private resolver keys in `.env.example` or committed files.
