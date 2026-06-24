import type { HeistTier } from "@bankroll/shared-types";
import { PublicKey } from "@solana/web3.js";

import {
  heistSeedPrefix,
  programConfigSeed,
  tierSeedBytes,
  tierVaultSeedPrefix,
} from "./constants.js";
import { utf8Seed, uuidSeed } from "./bytes.js";

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
