import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey(
  process.env.BANKROLL_PROGRAM_ID ??
    "H8xb7nuoB6uv9V9Eye1c8CWFuefcdDXwLri4VTd1mSyj",
);
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const KEYPAIR_PATH =
  process.env.SOLANA_DEPLOYER_KEYPAIR_PATH ??
  resolve(homedir(), ".config", "solana", "id.json");
const TIER_STREET = 0;
const STREET_HEIST_COST_LAMPORTS = 1_000_000n;
const STREET_PAYOUT_LAMPORTS = 500_000n;

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const payer = loadKeypair(KEYPAIR_PATH);
  const programAccount = await connection.getAccountInfo(PROGRAM_ID);

  if (!programAccount) {
    throw new Error(`Program is not deployed on ${RPC_URL}: ${PROGRAM_ID}`);
  }

  const programData = parseProgramDataAddress(programAccount.data);
  const config = derivePda([utf8("config")]);
  const streetVault = derivePda([utf8("vault"), Uint8Array.of(TIER_STREET)]);
  const playerBalanceBefore = await connection.getBalance(payer.publicKey);

  await initializeConfigIfNeeded({ config, connection, payer, programData });
  await initializeTierVaultIfNeeded({
    config,
    connection,
    payer,
    tier: TIER_STREET,
    tierVault: streetVault,
  });

  const idempotencyKey = randomUUID();
  const idempotencySeed = uuidBytes(idempotencyKey);
  const heist = derivePda([
    utf8("heist"),
    payer.publicKey.toBytes(),
    idempotencySeed,
  ]);
  const streetVaultBalanceBeforeEntry = await connection.getBalance(streetVault);
  const enterSignature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      enterHeistInstruction({
        config,
        crewIds: Uint8Array.of(0, 1, 5, 6),
        heist,
        heistCostLamports: STREET_HEIST_COST_LAMPORTS,
        idempotencySeed,
        player: payer.publicKey,
        targetId: fixedBytes32("corner-bank"),
        tier: TIER_STREET,
        tierVault: streetVault,
      }),
    ),
    [payer],
    { commitment: "confirmed" },
  );
  const streetVaultBalanceAfterEntry = await connection.getBalance(streetVault);
  const heistAfterEntry = await readHeist(connection, heist);

  assert(
    heistAfterEntry.status === 0,
    `expected pending heist after entry, got ${heistAfterEntry.status}`,
  );
  assert(
    streetVaultBalanceAfterEntry - streetVaultBalanceBeforeEntry ===
      Number(STREET_HEIST_COST_LAMPORTS),
    "street vault did not receive exact heist cost",
  );

  const playerBalanceBeforeSettle = await connection.getBalance(payer.publicKey);
  const streetVaultBalanceBeforeSettle =
    await connection.getBalance(streetVault);
  const settleSignature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      settleHeistInstruction({
        config,
        heist,
        outcome: 2,
        payoutLamports: STREET_PAYOUT_LAMPORTS,
        player: payer.publicKey,
        resolverAuthority: payer.publicKey,
        tierVault: streetVault,
      }),
    ),
    [payer],
    { commitment: "confirmed" },
  );
  const playerBalanceAfterSettle = await connection.getBalance(payer.publicKey);
  const streetVaultBalanceAfterSettle = await connection.getBalance(streetVault);
  const heistAfterSettle = await readHeist(connection, heist);
  const vaultAfterSettle = await readTierVault(connection, streetVault);

  assert(
    heistAfterSettle.status === 1,
    `expected settled heist, got ${heistAfterSettle.status}`,
  );
  assert(
    heistAfterSettle.payoutLamports === STREET_PAYOUT_LAMPORTS,
    `expected payout ${STREET_PAYOUT_LAMPORTS}, got ${heistAfterSettle.payoutLamports}`,
  );
  assert(
    streetVaultBalanceBeforeSettle - streetVaultBalanceAfterSettle ===
      Number(STREET_PAYOUT_LAMPORTS),
    "street vault did not debit exact payout",
  );
  assert(
    playerBalanceAfterSettle > playerBalanceBeforeSettle,
    "player balance did not increase after settlement payout",
  );
  assert(
    vaultAfterSettle.totalDeposits >= STREET_HEIST_COST_LAMPORTS,
    "vault total deposits were not recorded",
  );
  assert(
    vaultAfterSettle.totalPayouts >= STREET_PAYOUT_LAMPORTS,
    "vault total payouts were not recorded",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        cluster: RPC_URL,
        programId: PROGRAM_ID.toBase58(),
        player: payer.publicKey.toBase58(),
        config: config.toBase58(),
        streetVault: streetVault.toBase58(),
        heist: heist.toBase58(),
        idempotencyKey,
        enterSignature,
        settleSignature,
        playerBalanceBefore,
        playerBalanceBeforeSettle,
        playerBalanceAfterSettle,
        streetVaultBalanceBeforeEntry,
        streetVaultBalanceAfterEntry,
        streetVaultBalanceAfterSettle,
        heistAfterSettle: {
          status: heistAfterSettle.status,
          outcome: heistAfterSettle.outcome,
          payoutLamports: heistAfterSettle.payoutLamports.toString(),
        },
      },
      null,
      2,
    ),
  );
}

async function initializeConfigIfNeeded({
  config,
  connection,
  payer,
  programData,
}: {
  config: PublicKey;
  connection: Connection;
  payer: Keypair;
  programData: PublicKey;
}) {
  if (await accountExists(connection, config)) {
    return;
  }

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      initializeConfigInstruction({
        admin: payer.publicKey,
        config,
        programData,
        resolverAuthority: payer.publicKey,
      }),
    ),
    [payer],
    { commitment: "confirmed" },
  );
}

async function initializeTierVaultIfNeeded({
  config,
  connection,
  payer,
  tier,
  tierVault,
}: {
  config: PublicKey;
  connection: Connection;
  payer: Keypair;
  tier: number;
  tierVault: PublicKey;
}) {
  if (await accountExists(connection, tierVault)) {
    return;
  }

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      initializeTierVaultInstruction({
        admin: payer.publicKey,
        config,
        tier,
        tierVault,
      }),
    ),
    [payer],
    { commitment: "confirmed" },
  );
}

function initializeConfigInstruction({
  admin,
  config,
  programData,
  resolverAuthority,
}: {
  admin: PublicKey;
  config: PublicKey;
  programData: PublicKey;
  resolverAuthority: PublicKey;
}) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: programData, isSigner: false, isWritable: false },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      instructionDiscriminator("initialize_config"),
      resolverAuthority.toBuffer(),
    ]),
  });
}

function initializeTierVaultInstruction({
  admin,
  config,
  tier,
  tierVault,
}: {
  admin: PublicKey;
  config: PublicKey;
  tier: number;
  tierVault: PublicKey;
}) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: tierVault, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      instructionDiscriminator("initialize_tier_vault"),
      Buffer.from([tier]),
    ]),
  });
}

function enterHeistInstruction({
  config,
  crewIds,
  heist,
  heistCostLamports,
  idempotencySeed,
  player,
  targetId,
  tier,
  tierVault,
}: {
  config: PublicKey;
  crewIds: Uint8Array;
  heist: PublicKey;
  heistCostLamports: bigint;
  idempotencySeed: Uint8Array;
  player: PublicKey;
  targetId: Uint8Array;
  tier: number;
  tierVault: PublicKey;
}) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: tierVault, isSigner: false, isWritable: true },
      { pubkey: heist, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      instructionDiscriminator("enter_heist"),
      Buffer.from([tier]),
      Buffer.from(idempotencySeed),
      Buffer.from(targetId),
      Buffer.from(crewIds),
      u64(heistCostLamports),
    ]),
  });
}

function settleHeistInstruction({
  config,
  heist,
  outcome,
  payoutLamports,
  player,
  resolverAuthority,
  tierVault,
}: {
  config: PublicKey;
  heist: PublicKey;
  outcome: number;
  payoutLamports: bigint;
  player: PublicKey;
  resolverAuthority: PublicKey;
  tierVault: PublicKey;
}) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: tierVault, isSigner: false, isWritable: true },
      { pubkey: heist, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: false, isWritable: true },
      { pubkey: resolverAuthority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([
      instructionDiscriminator("settle_heist"),
      Buffer.from([outcome]),
      u64(payoutLamports),
    ]),
  });
}

async function readHeist(connection: Connection, address: PublicKey) {
  const account = await connection.getAccountInfo(address, "confirmed");

  if (!account) {
    throw new Error(`Heist account not found: ${address.toBase58()}`);
  }

  let offset = 8;
  const player = new PublicKey(account.data.subarray(offset, offset + 32));
  offset += 32;
  const tier = account.data.readUInt8(offset);
  offset += 1;
  const idempotencySeed = account.data.subarray(offset, offset + 16);
  offset += 16;
  const targetId = account.data.subarray(offset, offset + 32);
  offset += 32;
  const crewIds = account.data.subarray(offset, offset + 4);
  offset += 4;
  const heistCostLamports = account.data.readBigUInt64LE(offset);
  offset += 8;
  const status = account.data.readUInt8(offset);
  offset += 1;
  const outcome = account.data.readUInt8(offset);
  offset += 1;
  const payoutLamports = account.data.readBigUInt64LE(offset);

  return {
    player,
    tier,
    idempotencySeed,
    targetId,
    crewIds,
    heistCostLamports,
    status,
    outcome,
    payoutLamports,
  };
}

async function readTierVault(connection: Connection, address: PublicKey) {
  const account = await connection.getAccountInfo(address, "confirmed");

  if (!account) {
    throw new Error(`Tier vault account not found: ${address.toBase58()}`);
  }

  let offset = 8;
  const tier = account.data.readUInt8(offset);
  offset += 1;
  const bump = account.data.readUInt8(offset);
  offset += 1;
  const totalDeposits = account.data.readBigUInt64LE(offset);
  offset += 8;
  const totalPayouts = account.data.readBigUInt64LE(offset);
  offset += 8;
  const reservedPayouts = account.data.readBigUInt64LE(offset);

  return {
    tier,
    bump,
    totalDeposits,
    totalPayouts,
    reservedPayouts,
  };
}

async function accountExists(connection: Connection, address: PublicKey) {
  return Boolean(await connection.getAccountInfo(address, "confirmed"));
}

function derivePda(seeds: Uint8Array[]) {
  const [address] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);

  return address;
}

function instructionDiscriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function fixedBytes32(value: string) {
  return createHash("sha256").update(value).digest().subarray(0, 32);
}

function uuidBytes(value: string) {
  const normalized = value.replaceAll("-", "");
  const bytes = new Uint8Array(16);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      normalized.slice(index * 2, index * 2 + 2),
      16,
    );
  }

  return bytes;
}

function u64(value: bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);

  return buffer;
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function loadKeypair(path: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8")) as number[]),
  );
}

function parseProgramDataAddress(data: Buffer) {
  const discriminant = data.readUInt32LE(0);

  if (discriminant !== 2) {
    throw new Error(
      `Program account is not an upgradeable loader program; discriminant ${discriminant}`,
    );
  }

  return new PublicKey(data.subarray(4, 36));
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
