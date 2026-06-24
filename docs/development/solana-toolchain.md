# Solana And Anchor Toolchain Setup

The current target uses a Solana program with four tier vault PDAs on Devnet. Anchor is the recommended framework for this program unless a later decision explicitly chooses native Solana Rust.

Required commands:

```sh
solana --version
anchor --version
rustc --version
cargo --version
```

Current workspace status:

```txt
solana-cli 4.0.3
anchor-cli 1.0.2
rustup 1.29.0
rustc 1.96.0
cargo 1.96.0
Visual Studio Build Tools 2022 with C++ workload installed
```

The user PATH now includes:

```txt
C:\Users\reggi\.cargo\bin
C:\Users\reggi\.local\share\solana\install\active_release\bin
```

New terminals should find `solana`, `cargo`, `rustup`, `avm`, and `anchor`.

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

## Workspace Build Path

The Bankroll Mafia program currently builds with the direct Solana SBF builder:

```sh
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"" -arch=x64 && set PATH=%USERPROFILE%\.cargo\bin;%USERPROFILE%\.local\share\solana\install\active_release\bin;%PATH% && cargo build-sbf --manifest-path programs\bankroll-mafia\Cargo.toml"
```

Observed result:

```txt
Finished `release` profile [optimized]
```

The program id for the current Devnet build scaffold is:

```txt
H8xb7nuoB6uv9V9Eye1c8CWFuefcdDXwLri4VTd1mSyj
```

The generated local program keypair is intentionally ignored at:

```txt
target/deploy/bankroll_mafia-keypair.json
```

## Known Anchor CLI Caveat

`anchor build` is not yet reliable in this native Windows workspace.

Observed failures:

```txt
anchor build
Failed to execute rustup: program not found

C:\Users\reggi\.avm\bin\anchor-1.0.2 build
called `Option::unwrap()` on a `None` value
```

This appears to be an Anchor/AVM/cargo-build-sbf Windows execution issue because the same program succeeds through `cargo build-sbf` directly.

## Validation Before Resuming Future Anchor Work

Do not claim program build or deployment completion until these pass:

```sh
solana --version
anchor --version
cargo build-sbf --manifest-path programs/bankroll-mafia/Cargo.toml
```

Do not claim `anchor build` completion until the native Windows Anchor caveat above is fixed or the build is moved to WSL/Linux CI.

## Devnet Values Needed Later

Required Devnet values:

```txt
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
BANKROLL_PROGRAM_ID=<deployed program id>
```

Vault addresses should be derived from `BANKROLL_PROGRAM_ID` and the shared PDA seeds in `@bankroll/solana`, not hand-entered normal wallet addresses.

Do not use production/private admin or resolver keys in `.env.example` or committed files.
