import type { HeistTier } from "@bankroll/shared-types";
import { PublicKey } from "@solana/web3.js";

export const BANKROLL_PROGRAM_ID_ENV = "BANKROLL_PROGRAM_ID";
export const BANKROLL_SOLANA_CLUSTER_ENV = "SOLANA_CLUSTER";
export const BANKROLL_DEVNET_CLUSTER = "devnet";

export const programConfigSeed = "config";
export const tierVaultSeedPrefix = "vault";
export const heistSeedPrefix = "heist";

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

export function deriveProgramConfigPda(programId: PublicKey | string): DerivedPda {
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
    [
      utf8Seed(heistSeedPrefix),
      wallet.toBuffer(),
      uuidSeed(idempotencyKey),
    ],
    programId,
  );
}

export function getRequiredProgramIdFromEnv(env: Record<string, string | undefined>) {
  const value = env[BANKROLL_PROGRAM_ID_ENV];

  if (!value) {
    throw new Error(`${BANKROLL_PROGRAM_ID_ENV} is required`);
  }

  return new PublicKey(value);
}

function derivePda(seeds: Uint8Array[], programId: PublicKey | string): DerivedPda {
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
    seed[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }

  return seed;
}
