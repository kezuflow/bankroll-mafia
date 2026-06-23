import { outcomeTable, type TierConfig } from "@bankroll/game-config";
import type { OutcomeId } from "@bankroll/shared-types";

import {
  calculateDailyVaultPayoutCap,
  calculateExpectedPayout,
  calculateRtpBasisPoints,
  calculateVaultPayout,
} from "./index.js";

export interface PayoutProfile {
  vault_jackpot: bigint;
  full_success: bigint;
  partial_success: bigint;
  soft_fail: bigint;
  arrested: bigint;
}

export interface SimulationInput {
  heistCostBaseUnits: bigint;
  payoutProfile: PayoutProfile;
  roundsPerOutcomeUnit?: number;
}

export interface SimulationResult {
  heistsSimulated: number;
  totalWageredBaseUnits: bigint;
  totalPayoutBaseUnits: bigint;
  observedRtpBasisPoints: number;
  expectedPayoutBaseUnits: bigint;
  expectedRtpBasisPoints: number;
  houseCaptureBaseUnits: bigint;
}

export interface VaultStressInput {
  tierConfig: TierConfig;
  dayStartVaultPoolBaseUnits: bigint;
  heistCostBaseUnits: bigint;
  vaultHits: number;
  vaultPercentBasisPoints: number;
}

export interface VaultStressResult {
  totalPaidBaseUnits: bigint;
  remainingDailyCapBaseUnits: bigint;
  finalVaultPoolBaseUnits: bigint;
  payouts: bigint[];
}

export function simulateDeterministicHeists(
  input: SimulationInput,
): SimulationResult {
  if (input.heistCostBaseUnits <= 0n) {
    throw new Error("heistCostBaseUnits must be greater than zero");
  }

  const roundsPerOutcomeUnit = input.roundsPerOutcomeUnit ?? 1;

  if (!Number.isInteger(roundsPerOutcomeUnit) || roundsPerOutcomeUnit <= 0) {
    throw new Error("roundsPerOutcomeUnit must be a positive integer");
  }

  const expectedPayoutBaseUnits = calculateExpectedPayout(
    outcomeTable.map((outcome) => ({
      probabilityBasisPoints: outcome.probabilityBasisPoints,
      payoutBaseUnits: input.payoutProfile[outcome.id],
    })),
  );
  const expectedRtpBasisPoints = calculateRtpBasisPoints(
    expectedPayoutBaseUnits,
    input.heistCostBaseUnits,
  );
  let totalPayoutBaseUnits = 0n;
  let heistsSimulated = 0;

  for (const outcome of outcomeTable) {
    const count = outcome.probabilityBasisPoints * roundsPerOutcomeUnit;
    heistsSimulated += count;
    totalPayoutBaseUnits += input.payoutProfile[outcome.id] * BigInt(count);
  }

  const totalWageredBaseUnits =
    input.heistCostBaseUnits * BigInt(heistsSimulated);
  const observedRtpBasisPoints = calculateRtpBasisPoints(
    totalPayoutBaseUnits,
    totalWageredBaseUnits,
  );

  return {
    heistsSimulated,
    totalWageredBaseUnits,
    totalPayoutBaseUnits,
    observedRtpBasisPoints,
    expectedPayoutBaseUnits,
    expectedRtpBasisPoints,
    houseCaptureBaseUnits: totalWageredBaseUnits - totalPayoutBaseUnits,
  };
}

export function stressVaultHits(input: VaultStressInput): VaultStressResult {
  if (!Number.isInteger(input.vaultHits) || input.vaultHits < 0) {
    throw new Error("vaultHits must be a non-negative integer");
  }

  let remainingDailyCapBaseUnits = calculateDailyVaultPayoutCap(
    input.dayStartVaultPoolBaseUnits,
    input.tierConfig.dailyVaultPercentBasisPoints,
    input.tierConfig.absoluteDailyVaultCapBaseUnits,
  );
  let finalVaultPoolBaseUnits = input.dayStartVaultPoolBaseUnits;
  let totalPaidBaseUnits = 0n;
  const payouts: bigint[] = [];

  for (let index = 0; index < input.vaultHits; index += 1) {
    const payout = calculateVaultPayout({
      tierVaultPoolBaseUnits: finalVaultPoolBaseUnits,
      heistCostBaseUnits: input.heistCostBaseUnits,
      vaultPercentBasisPoints: input.vaultPercentBasisPoints,
      maxMultiplierBasisPoints: input.tierConfig.vaultMaxMultiplierBasisPoints,
      remainingDailyPayoutCapBaseUnits: remainingDailyCapBaseUnits,
    });

    if (payout > finalVaultPoolBaseUnits) {
      throw new Error("Vault payout exceeds vault pool");
    }

    finalVaultPoolBaseUnits -= payout;
    remainingDailyCapBaseUnits -= payout;
    totalPaidBaseUnits += payout;
    payouts.push(payout);
  }

  return {
    totalPaidBaseUnits,
    remainingDailyCapBaseUnits,
    finalVaultPoolBaseUnits,
    payouts,
  };
}

export function getPayoutForOutcome(
  profile: PayoutProfile,
  outcome: OutcomeId,
) {
  return profile[outcome];
}

