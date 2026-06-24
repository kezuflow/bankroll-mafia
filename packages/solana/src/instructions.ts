import type { HeistTier } from "@bankroll/shared-types";
import { Buffer } from "node:buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  enterHeistDiscriminator,
  settleHeistDiscriminator,
  tierSeedBytes,
} from "./constants.js";
import {
  assertFixedBytes,
  concatBytes,
  u64Le,
  uuidSeed,
  uuidStringFromSeed,
} from "./bytes.js";
import {
  deriveHeistPda,
  deriveProgramConfigPda,
  deriveTierVaultPda,
} from "./pda.js";

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
