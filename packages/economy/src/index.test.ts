import { describe, expect, it } from "vitest";

import { SOL, tierConfigs } from "@bankroll/game-config";
import {
  applyCrewModifiers,
  assertRepeatableRtpBelowCap,
  assertTierRtpBounds,
  calculateDailyVaultPayoutCap,
  calculateExpectedPayout,
  calculateRtpBasisPoints,
  calculateVaultEV,
  calculateVaultPayout,
} from "./index.js";

describe("vault math", () => {
  it("caps vault payout by entry multiplier before pool share", () => {
    const payout = calculateVaultPayout({
      tierVaultPoolBaseUnits: 50_000n * SOL,
      heistCostBaseUnits: 10n * SOL,
      vaultPercentBasisPoints: 100,
      maxMultiplierBasisPoints: 200_000,
      remainingDailyPayoutCapBaseUnits: 2_000n * SOL,
    });

    expect(payout).toBe(200n * SOL);
  });

  it("caps vault payout by remaining daily budget", () => {
    const payout = calculateVaultPayout({
      tierVaultPoolBaseUnits: 50_000n * SOL,
      heistCostBaseUnits: 10n * SOL,
      vaultPercentBasisPoints: 100,
      maxMultiplierBasisPoints: 200_000,
      remainingDailyPayoutCapBaseUnits: 25n * SOL,
    });

    expect(payout).toBe(25n * SOL);
  });

  it("calculates daily cap as lower of vault percent and absolute cap", () => {
    const streetCap = calculateDailyVaultPayoutCap(
      50_000n * SOL,
      2_000,
      2_000n * SOL,
    );

    expect(streetCap).toBe(2_000n * SOL);
  });

  it("calculates vault EV from hit chance and capped payout", () => {
    const ev = calculateVaultEV(100, 200n * SOL);

    expect(ev).toBe(2n * SOL);
  });
});

describe("RTP math", () => {
  it("matches the documented 88% street example", () => {
    const expectedPayout = calculateExpectedPayout([
      { probabilityBasisPoints: 100, payoutBaseUnits: 200n * SOL },
      { probabilityBasisPoints: 3_900, payoutBaseUnits: 12n * SOL },
      { probabilityBasisPoints: 3_000, payoutBaseUnits: 6n * SOL },
      { probabilityBasisPoints: 2_000, payoutBaseUnits: 1n * SOL },
      { probabilityBasisPoints: 1_000, payoutBaseUnits: 1_200_000_000n },
    ]);

    expect(expectedPayout).toBe(8_800_000_000n);
    expect(calculateRtpBasisPoints(expectedPayout, 10n * SOL)).toBe(8_800);
  });

  it("rejects RTP outside tier bounds", () => {
    const street = tierConfigs[0]!;

    expect(() => assertTierRtpBounds(8_800, street)).not.toThrow();
    expect(() => assertTierRtpBounds(9_000, street)).toThrow();
  });

  it("rejects repeatable RTP at or above the hard cap", () => {
    expect(() => assertRepeatableRtpBelowCap(9_699)).not.toThrow();
    expect(() => assertRepeatableRtpBelowCap(9_700)).toThrow();
  });
});

describe("crew modifiers", () => {
  it("limits crews to four unique members", () => {
    expect(() => applyCrewModifiers(["driver", "driver"])).toThrow(
      "Crew IDs must be unique",
    );

    expect(() =>
      applyCrewModifiers(["driver", "hacker", "insider", "cleaner", "lawyer"]),
    ).toThrow("at most four");
  });

  it("makes crew perks explicit tradeoffs instead of pure upgrades", () => {
    const hacker = applyCrewModifiers(["hacker"]);
    const safeRun = applyCrewModifiers([
      "driver",
      "cleaner",
      "lookout",
      "lawyer",
    ]);

    expect(hacker.vaultChanceDeltaBasisPoints).toBeGreaterThan(0);
    expect(hacker.fullSuccessDeltaBasisPoints).toBeLessThan(0);
    expect(safeRun.arrestedDeltaBasisPoints).toBeLessThan(0);
    expect(safeRun.payoutMultiplierDeltaBasisPoints).toBeLessThan(0);
  });
});
