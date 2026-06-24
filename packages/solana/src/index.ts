import type { HeistTier } from "@bankroll/shared-types";
import { Buffer } from "node:buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const BANKROLL_PROGRAM_ID_ENV = "BANKROLL_PROGRAM_ID";
export const BANKROLL_SOLANA_CLUSTER_ENV = "SOLANA_CLUSTER";
export const BANKROLL_DEVNET_CLUSTER = "devnet";

export const programConfigSeed = "config";
export const tierVaultSeedPrefix = "vault";
export const heistSeedPrefix = "heist";
export const enterHeistDiscriminator = Uint8Array.from([
  199, 255, 132, 181, 245, 210, 77, 43,
]);
export const settleHeistDiscriminator = Uint8Array.from([
  93, 144, 141, 243, 67, 181, 116, 102,
]);
export const heistAccountDiscriminator = Uint8Array.from([
  20, 157, 251, 187, 252, 185, 224, 242,
]);

export const tierSeedBytes = {
  street: 0,
  crew: 1,
  boss: 2,
  highroller: 3,
} as const satisfies Record<HeistTier, number>;

export interface DerivedPda {
  address: PublicKey;
  bump: number;
}

export function deriveProgramConfigPda(
  programId: PublicKey | string,
): DerivedPda {
  return derivePda([utf8Seed(programConfigSeed)], programId);
}

export function deriveTierVaultPda({
  programId,
  tier,
}: {
  programId: PublicKey | string;
  tier: HeistTier;
}): DerivedPda {
  return derivePda(
    [utf8Seed(tierVaultSeedPrefix), new Uint8Array([tierSeedBytes[tier]])],
    programId,
  );
}

export function deriveHeistPda({
  programId,
  walletAddress,
  idempotencyKey,
}: {
  programId: PublicKey | string;
  walletAddress: PublicKey | string;
  idempotencyKey: string;
}): DerivedPda {
  const wallet =
    walletAddress instanceof PublicKey
      ? walletAddress
      : new PublicKey(walletAddress);

  return derivePda(
    [utf8Seed(heistSeedPrefix), wallet.toBuffer(), uuidSeed(idempotencyKey)],
    programId,
  );
}

export function getRequiredProgramIdFromEnv(
  env: Record<string, string | undefined>,
) {
  const value = env[BANKROLL_PROGRAM_ID_ENV];

  if (!value) {
    throw new Error(`${BANKROLL_PROGRAM_ID_ENV} is required`);
  }

  return new PublicKey(value);
}

export function buildEnterHeistInstruction({
  programId,
  player,
  tier,
  idempotencySeed,
  targetIdSeed,
  crewIds,
  heistCostLamports,
}: {
  programId: PublicKey | string;
  player: PublicKey | string;
  tier: HeistTier;
  idempotencySeed: Uint8Array;
  targetIdSeed: Uint8Array;
  crewIds: Uint8Array;
  heistCostLamports: bigint;
}) {
  assertFixedBytes("idempotencySeed", idempotencySeed, 16);
  assertFixedBytes("targetIdSeed", targetIdSeed, 32);
  assertFixedBytes("crewIds", crewIds, 4);

  const resolvedProgramId =
    programId instanceof PublicKey ? programId : new PublicKey(programId);
  const playerPubkey =
    player instanceof PublicKey ? player : new PublicKey(player);
  const config = deriveProgramConfigPda(resolvedProgramId).address;
  const tierVault = deriveTierVaultPda({
    programId: resolvedProgramId,
    tier,
  }).address;
  const heist = deriveHeistPda({
    programId: resolvedProgramId,
    walletAddress: playerPubkey,
    idempotencyKey: uuidStringFromSeed(idempotencySeed),
  }).address;

  return new TransactionInstruction({
    programId: resolvedProgramId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: tierVault, isSigner: false, isWritable: true },
      { pubkey: heist, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(
      concatBytes(
        enterHeistDiscriminator,
        new Uint8Array([tierSeedBytes[tier]]),
        idempotencySeed,
        targetIdSeed,
        crewIds,
        u64Le(heistCostLamports),
      ),
    ),
  });
}

export function buildEnterHeistTransaction({
  programId,
  player,
  tier,
  idempotencyKey,
  targetIdSeed,
  crewIds,
  heistCostLamports,
  blockhash,
}: {
  programId: PublicKey | string;
  player: PublicKey | string;
  tier: HeistTier;
  idempotencyKey: string;
  targetIdSeed: Uint8Array;
  crewIds: Uint8Array;
  heistCostLamports: bigint;
  blockhash: string;
}) {
  const playerPubkey =
    player instanceof PublicKey ? player : new PublicKey(player);

  return new Transaction({
    feePayer: playerPubkey,
    recentBlockhash: blockhash,
  }).add(
    buildEnterHeistInstruction({
      programId,
      player: playerPubkey,
      tier,
      idempotencySeed: uuidSeed(idempotencyKey),
      targetIdSeed,
      crewIds,
      heistCostLamports,
    }),
  );
}

export function buildSettleHeistInstruction({
  programId,
  player,
  resolverAuthority,
  tier,
  idempotencyKey,
  outcome,
  payoutLamports,
}: {
  programId: PublicKey | string;
  player: PublicKey | string;
  resolverAuthority: PublicKey | string;
  tier: HeistTier;
  idempotencyKey: string;
  outcome: number;
  payoutLamports: bigint;
}) {
  const resolvedProgramId =
    programId instanceof PublicKey ? programId : new PublicKey(programId);
  const playerPubkey =
    player instanceof PublicKey ? player : new PublicKey(player);
  const resolverPubkey =
    resolverAuthority instanceof PublicKey
      ? resolverAuthority
      : new PublicKey(resolverAuthority);

  return new TransactionInstruction({
    programId: resolvedProgramId,
    keys: [
      {
        pubkey: deriveProgramConfigPda(resolvedProgramId).address,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: deriveTierVaultPda({ programId: resolvedProgramId, tier })
          .address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: deriveHeistPda({
          programId: resolvedProgramId,
          walletAddress: playerPubkey,
          idempotencyKey,
        }).address,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: playerPubkey, isSigner: false, isWritable: true },
      { pubkey: resolverPubkey, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(
      concatBytes(
        settleHeistDiscriminator,
        new Uint8Array([outcome]),
        u64Le(payoutLamports),
      ),
    ),
  });
}

export interface DecodedHeistAccount {
  player: PublicKey;
  tier: number;
  idempotencySeed: Uint8Array;
  targetIdSeed: Uint8Array;
  crewIds: Uint8Array;
  heistCostLamports: bigint;
  status: number;
  outcome: number;
  payoutLamports: bigint;
  bump: number;
}

export function decodeHeistAccount(data: Uint8Array): DecodedHeistAccount {
  if (data.length < 112) {
    throw new Error("Heist account data is too short");
  }

  assertBytesEqual(data.slice(0, 8), heistAccountDiscriminator);

  return {
    player: new PublicKey(data.slice(8, 40)),
    tier: data[40]!,
    idempotencySeed: data.slice(41, 57),
    targetIdSeed: data.slice(57, 89),
    crewIds: data.slice(89, 93),
    heistCostLamports: readU64Le(data.slice(93, 101)),
    status: data[101]!,
    outcome: data[102]!,
    payoutLamports: readU64Le(data.slice(103, 111)),
    bump: data[111]!,
  };
}

function derivePda(
  seeds: Uint8Array[],
  programId: PublicKey | string,
): DerivedPda {
  const resolvedProgramId =
    programId instanceof PublicKey ? programId : new PublicKey(programId);
  const [address, bump] = PublicKey.findProgramAddressSync(
    seeds,
    resolvedProgramId,
  );

  return {
    address,
    bump,
  };
}

function utf8Seed(value: string) {
  return new TextEncoder().encode(value);
}

function uuidSeed(value: string) {
  const normalized = value.replaceAll("-", "");

  if (!/^[0-9a-fA-F]{32}$/.test(normalized)) {
    throw new Error("idempotencyKey must be a UUID");
  }

  const seed = new Uint8Array(16);

  for (let index = 0; index < seed.length; index += 1) {
    seed[index] = Number.parseInt(
      normalized.slice(index * 2, index * 2 + 2),
      16,
    );
  }

  return seed;
}

function uuidStringFromSeed(seed: Uint8Array) {
  assertFixedBytes("idempotencySeed", seed, 16);
  const hex = Array.from(seed, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertFixedBytes(name: string, value: Uint8Array, length: number) {
  if (value.length !== length) {
    throw new Error(`${name} must be ${length} bytes`);
  }
}

function assertBytesEqual(actual: Uint8Array, expected: Uint8Array) {
  if (
    actual.length !== expected.length ||
    actual.some((byte, index) => byte !== expected[index])
  ) {
    throw new Error("Invalid heist account discriminator");
  }
}

function concatBytes(...chunks: Uint8Array[]) {
  const output = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function u64Le(value: bigint) {
  if (value < 0n || value > 18_446_744_073_709_551_615n) {
    throw new Error("u64 value out of range");
  }

  const output = new Uint8Array(8);
  const view = new DataView(output.buffer);
  view.setBigUint64(0, value, true);

  return output;
}

function readU64Le(value: Uint8Array) {
  assertFixedBytes("u64", value, 8);

  return new DataView(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  ).getBigUint64(0, true);
}
