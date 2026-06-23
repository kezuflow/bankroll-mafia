export const HEIST_TIERS = ["street", "crew", "boss", "highroller"] as const;
export type HeistTier = (typeof HEIST_TIERS)[number];

export const CREW_IDS = [
  "driver",
  "hacker",
  "insider",
  "cleaner",
  "enforcer",
  "lockpick",
  "lookout",
  "lawyer",
] as const;
export type CrewId = (typeof CREW_IDS)[number];

export const OUTCOME_IDS = [
  "vault_jackpot",
  "full_success",
  "partial_success",
  "soft_fail",
  "arrested",
] as const;
export type OutcomeId = (typeof OUTCOME_IDS)[number];

export type BaseUnits = bigint;

export interface HeistIntent {
  tier: HeistTier;
  targetId: string;
  crewIds: CrewId[];
  heistCostBaseUnits: BaseUnits;
  idempotencyKey: string;
}

export interface SettlementResult {
  outcome: OutcomeId;
  payoutBaseUnits: BaseUnits;
  vaultPayoutBaseUnits: BaseUnits;
  rtpBasisPoints: number;
}

