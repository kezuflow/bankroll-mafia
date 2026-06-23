import { describe, expect, it } from "vitest";

import { SOL, tierConfigs } from "@bankroll/game-config";

import {
  simulateDeterministicHeists,
  stressVaultHits,
  type PayoutProfile,
} from "./simulation.js";

const streetProfile = {
  vault_jackpot: 200n * SOL,
  full_success: 12n * SOL,
  partial_success: 6n * SOL,
  soft_fail: 1n * SOL,
  arrested: 1_200_000_000n,
} satisfies PayoutProfile;

describe("deterministic heist simulation", () => {
  it("simulates 10,000+ heists and matches expected 88% RTP", () => {
    const result = simulateDeterministicHeists({
      heistCostBaseUnits: 10n * SOL,
      payoutProfile: streetProfile,
      roundsPerOutcomeUnit: 2,
    });

    expect(result.heistsSimulated).toBe(20_000);
    expect(result.expectedRtpBasisPoints).toBe(8_800);
    expect(result.observedRtpBasisPoints).toBe(8_800);
    expect(result.houseCaptureBaseUnits).toBeGreaterThan(0n);
  });

  it("keeps high-volume bot spam negative EV", () => {
    const result = simulateDeterministicHeists({
      heistCostBaseUnits: 10n * SOL,
      payoutProfile: streetProfile,
      roundsPerOutcomeUnit: 20,
    });

    expect(result.heistsSimulated).toBe(200_000);
    expect(result.totalPayoutBaseUnits).toBeLessThan(
      result.totalWageredBaseUnits,
    );
    expect(result.houseCaptureBaseUnits).toBe(
      result.totalWageredBaseUnits - result.totalPayoutBaseUnits,
    );
  });
});

describe("vault stress simulation", () => {
  it("does not exceed daily payout cap during repeated vault hits", () => {
    const street = tierConfigs[0]!;
    const result = stressVaultHits({
      tierConfig: street,
      dayStartVaultPoolBaseUnits: 50_000n * SOL,
      heistCostBaseUnits: 10n * SOL,
      vaultHits: 100,
      vaultPercentBasisPoints: 100,
    });

    expect(result.totalPaidBaseUnits).toBe(street.absoluteDailyVaultCapBaseUnits);
    expect(result.remainingDailyCapBaseUnits).toBe(0n);
    expect(result.finalVaultPoolBaseUnits).toBeGreaterThanOrEqual(0n);
  });

  it("caps each highroller hit by entry multiplier before draining the vault", () => {
    const highroller = tierConfigs[3]!;
    const result = stressVaultHits({
      tierConfig: highroller,
      dayStartVaultPoolBaseUnits: 10_000_000n * SOL,
      heistCostBaseUnits: 50n * SOL,
      vaultHits: 5,
      vaultPercentBasisPoints: 100,
    });

    expect(result.payouts).toEqual([
      250n * SOL,
      250n * SOL,
      250n * SOL,
      250n * SOL,
      0n,
    ]);
    expect(result.totalPaidBaseUnits).toBe(
      highroller.absoluteDailyVaultCapBaseUnits,
    );
  });
});
