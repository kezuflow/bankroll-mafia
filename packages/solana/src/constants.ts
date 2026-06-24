import type { HeistTier } from "@bankroll/shared-types";

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
