import type { CrewId, HeistTier, OutcomeId } from "@bankroll/shared-types";

export const BASIS_POINTS = 10_000;
export const SOL_DECIMALS = 9;
export const LAMPORTS_PER_SOL = 10n ** BigInt(SOL_DECIMALS);
export const SOL = LAMPORTS_PER_SOL;

export interface TierConfig {
  id: HeistTier;
  label: string;
  minCostBaseUnits: bigint;
  maxCostBaseUnits: bigint;
  minRtpBasisPoints: number;
  maxRtpBasisPoints: number;
  vaultMaxMultiplierBasisPoints: number;
  dailyVaultPercentBasisPoints: number;
  absoluteDailyVaultCapBaseUnits: bigint;
}

export interface OutcomeConfig {
  id: OutcomeId;
  label: string;
  probabilityBasisPoints: number;
}

export interface CrewConfig {
  id: CrewId;
  label: string;
  effect: string;
  tradeoff: string;
}

export const outcomeTable = [
  {
    id: "vault_jackpot",
    label: "Vault Jackpot",
    probabilityBasisPoints: 100,
  },
  {
    id: "full_success",
    label: "Full Success",
    probabilityBasisPoints: 3_900,
  },
  {
    id: "partial_success",
    label: "Partial Success",
    probabilityBasisPoints: 3_000,
  },
  {
    id: "soft_fail",
    label: "Soft Fail",
    probabilityBasisPoints: 2_000,
  },
  {
    id: "arrested",
    label: "Arrested",
    probabilityBasisPoints: 1_000,
  },
] satisfies OutcomeConfig[];

export const tierConfigs = [
  {
    id: "street",
    label: "Street",
    minCostBaseUnits: 1_000_000n,
    maxCostBaseUnits: 50_000_000n,
    minRtpBasisPoints: 8_400,
    maxRtpBasisPoints: 8_800,
    vaultMaxMultiplierBasisPoints: 200_000,
    dailyVaultPercentBasisPoints: 2_000,
    absoluteDailyVaultCapBaseUnits: 10n * SOL,
  },
  {
    id: "crew",
    label: "Crew",
    minCostBaseUnits: 100_000_000n,
    maxCostBaseUnits: 500_000_000n,
    minRtpBasisPoints: 8_500,
    maxRtpBasisPoints: 8_900,
    vaultMaxMultiplierBasisPoints: 150_000,
    dailyVaultPercentBasisPoints: 1_500,
    absoluteDailyVaultCapBaseUnits: 50n * SOL,
  },
  {
    id: "boss",
    label: "Boss",
    minCostBaseUnits: 1n * SOL,
    maxCostBaseUnits: 5n * SOL,
    minRtpBasisPoints: 8_600,
    maxRtpBasisPoints: 9_000,
    vaultMaxMultiplierBasisPoints: 100_000,
    dailyVaultPercentBasisPoints: 1_000,
    absoluteDailyVaultCapBaseUnits: 250n * SOL,
  },
  {
    id: "highroller",
    label: "Highroller",
    minCostBaseUnits: 10n * SOL,
    maxCostBaseUnits: 50n * SOL,
    minRtpBasisPoints: 8_700,
    maxRtpBasisPoints: 9_100,
    vaultMaxMultiplierBasisPoints: 50_000,
    dailyVaultPercentBasisPoints: 500,
    absoluteDailyVaultCapBaseUnits: 1_000n * SOL,
  },
] satisfies TierConfig[];

export const crewConfigs = [
  {
    id: "driver",
    label: "Driver",
    effect: "Better escape chance and lower arrest chance.",
    tradeoff: "More soft fails or lower upside.",
  },
  {
    id: "hacker",
    label: "Hacker",
    effect: "Better vault odds and cyber/bank target strength.",
    tradeoff: "Lower normal success EV.",
  },
  {
    id: "insider",
    label: "Insider",
    effect: "Better full-success chance and target weakness reveal.",
    tradeoff: "Lower partial-success or vault EV.",
  },
  {
    id: "cleaner",
    label: "Cleaner",
    effect: "Lower evidence fantasy and smoother downside.",
    tradeoff: "No direct top-end boost.",
  },
  {
    id: "enforcer",
    label: "Enforcer",
    effect: "Higher payout fantasy.",
    tradeoff: "Higher arrest risk or worse downside.",
  },
  {
    id: "lockpick",
    label: "Lockpick",
    effect: "Better partial success and access fantasy.",
    tradeoff: "Lower full-success or jackpot EV.",
  },
  {
    id: "lookout",
    label: "Lookout",
    effect: "Lower police/ambush risk and safer outcomes.",
    tradeoff: "Lower upside.",
  },
  {
    id: "lawyer",
    label: "Lawyer",
    effect: "Better arrested outcome.",
    tradeoff: "No success boost and lower top-end potential.",
  },
] satisfies CrewConfig[];
