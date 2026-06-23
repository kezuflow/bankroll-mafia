import { BASIS_POINTS, type TierConfig } from "@bankroll/game-config";
import type { CrewId } from "@bankroll/shared-types";

export * from "./simulation.js";

export interface VaultPayoutInput {
  tierVaultPoolBaseUnits: bigint;
  heistCostBaseUnits: bigint;
  vaultPercentBasisPoints: number;
  maxMultiplierBasisPoints: number;
  remainingDailyPayoutCapBaseUnits: bigint;
}

export interface ExpectedPayoutTerm {
  probabilityBasisPoints: number;
  payoutBaseUnits: bigint;
}

export interface CrewModifierResult {
  vaultChanceDeltaBasisPoints: number;
  fullSuccessDeltaBasisPoints: number;
  partialSuccessDeltaBasisPoints: number;
  softFailDeltaBasisPoints: number;
  arrestedDeltaBasisPoints: number;
  payoutMultiplierDeltaBasisPoints: number;
}

export function multiplyBasisPoints(amount: bigint, basisPoints: number) {
  assertNonNegativeBigint(amount, "amount");
  assertBasisPointsLike(basisPoints, "basisPoints");

  return (amount * BigInt(basisPoints)) / BigInt(BASIS_POINTS);
}

export function calculateVaultPayout(input: VaultPayoutInput) {
  assertNonNegativeBigint(input.tierVaultPoolBaseUnits, "tierVaultPoolBaseUnits");
  assertNonNegativeBigint(input.heistCostBaseUnits, "heistCostBaseUnits");
  assertNonNegativeBigint(
    input.remainingDailyPayoutCapBaseUnits,
    "remainingDailyPayoutCapBaseUnits",
  );

  const poolShare = multiplyBasisPoints(
    input.tierVaultPoolBaseUnits,
    input.vaultPercentBasisPoints,
  );
  const entryCap = multiplyBasisPoints(
    input.heistCostBaseUnits,
    input.maxMultiplierBasisPoints,
  );

  return minBigint(poolShare, entryCap, input.remainingDailyPayoutCapBaseUnits);
}

export function calculateDailyVaultPayoutCap(
  tierVaultPoolAtDayStartBaseUnits: bigint,
  dailyVaultPercentBasisPoints: number,
  absoluteDailyTierCapBaseUnits: bigint,
) {
  assertNonNegativeBigint(
    tierVaultPoolAtDayStartBaseUnits,
    "tierVaultPoolAtDayStartBaseUnits",
  );
  assertNonNegativeBigint(
    absoluteDailyTierCapBaseUnits,
    "absoluteDailyTierCapBaseUnits",
  );

  const percentCap = multiplyBasisPoints(
    tierVaultPoolAtDayStartBaseUnits,
    dailyVaultPercentBasisPoints,
  );

  return minBigint(percentCap, absoluteDailyTierCapBaseUnits);
}

export function calculateVaultEV(
  vaultHitChanceBasisPoints: number,
  vaultPayoutBaseUnits: bigint,
) {
  return multiplyBasisPoints(vaultPayoutBaseUnits, vaultHitChanceBasisPoints);
}

export function calculateExpectedPayout(terms: ExpectedPayoutTerm[]) {
  return terms.reduce((total, term) => {
    assertBasisPointsLike(
      term.probabilityBasisPoints,
      "probabilityBasisPoints",
    );
    assertNonNegativeBigint(term.payoutBaseUnits, "payoutBaseUnits");

    return (
      total +
      multiplyBasisPoints(term.payoutBaseUnits, term.probabilityBasisPoints)
    );
  }, 0n);
}

export function calculateRtpBasisPoints(
  expectedPayoutBaseUnits: bigint,
  heistCostBaseUnits: bigint,
) {
  assertNonNegativeBigint(expectedPayoutBaseUnits, "expectedPayoutBaseUnits");

  if (heistCostBaseUnits <= 0n) {
    throw new Error("heistCostBaseUnits must be greater than zero");
  }

  return Number(
    (expectedPayoutBaseUnits * BigInt(BASIS_POINTS)) / heistCostBaseUnits,
  );
}

export function assertTierRtpBounds(
  rtpBasisPoints: number,
  tierConfig: Pick<TierConfig, "minRtpBasisPoints" | "maxRtpBasisPoints">,
) {
  if (
    rtpBasisPoints < tierConfig.minRtpBasisPoints ||
    rtpBasisPoints > tierConfig.maxRtpBasisPoints
  ) {
    throw new Error(
      `RTP ${rtpBasisPoints} is outside tier bounds ${tierConfig.minRtpBasisPoints}-${tierConfig.maxRtpBasisPoints}`,
    );
  }
}

export function assertRepeatableRtpBelowCap(
  rtpBasisPoints: number,
  capBasisPoints = 9_700,
) {
  if (rtpBasisPoints >= capBasisPoints) {
    throw new Error(`Repeatable RTP must stay below ${capBasisPoints}`);
  }
}

export function applyCrewModifiers(crewIds: CrewId[]): CrewModifierResult {
  const uniqueCrewIds = new Set(crewIds);

  if (crewIds.length !== uniqueCrewIds.size) {
    throw new Error("Crew IDs must be unique");
  }

  if (crewIds.length > 4) {
    throw new Error("A heist can use at most four crew members");
  }

  return crewIds.reduce<CrewModifierResult>(
    (result, crewId) => addCrewModifier(result, crewId),
    {
      vaultChanceDeltaBasisPoints: 0,
      fullSuccessDeltaBasisPoints: 0,
      partialSuccessDeltaBasisPoints: 0,
      softFailDeltaBasisPoints: 0,
      arrestedDeltaBasisPoints: 0,
      payoutMultiplierDeltaBasisPoints: 0,
    },
  );
}

function addCrewModifier(
  result: CrewModifierResult,
  crewId: CrewId,
): CrewModifierResult {
  switch (crewId) {
    case "driver":
      return {
        ...result,
        arrestedDeltaBasisPoints: result.arrestedDeltaBasisPoints - 200,
        softFailDeltaBasisPoints: result.softFailDeltaBasisPoints + 200,
      };
    case "hacker":
      return {
        ...result,
        vaultChanceDeltaBasisPoints: result.vaultChanceDeltaBasisPoints + 25,
        fullSuccessDeltaBasisPoints: result.fullSuccessDeltaBasisPoints - 25,
      };
    case "insider":
      return {
        ...result,
        fullSuccessDeltaBasisPoints: result.fullSuccessDeltaBasisPoints + 200,
        partialSuccessDeltaBasisPoints:
          result.partialSuccessDeltaBasisPoints - 200,
      };
    case "cleaner":
      return {
        ...result,
        arrestedDeltaBasisPoints: result.arrestedDeltaBasisPoints - 100,
        payoutMultiplierDeltaBasisPoints:
          result.payoutMultiplierDeltaBasisPoints - 100,
      };
    case "enforcer":
      return {
        ...result,
        arrestedDeltaBasisPoints: result.arrestedDeltaBasisPoints + 150,
        payoutMultiplierDeltaBasisPoints:
          result.payoutMultiplierDeltaBasisPoints + 150,
      };
    case "lockpick":
      return {
        ...result,
        partialSuccessDeltaBasisPoints:
          result.partialSuccessDeltaBasisPoints + 200,
        fullSuccessDeltaBasisPoints: result.fullSuccessDeltaBasisPoints - 200,
      };
    case "lookout":
      return {
        ...result,
        arrestedDeltaBasisPoints: result.arrestedDeltaBasisPoints - 150,
        payoutMultiplierDeltaBasisPoints:
          result.payoutMultiplierDeltaBasisPoints - 50,
      };
    case "lawyer":
      return {
        ...result,
        arrestedDeltaBasisPoints: result.arrestedDeltaBasisPoints - 100,
        vaultChanceDeltaBasisPoints: result.vaultChanceDeltaBasisPoints - 10,
      };
  }
}

function minBigint(first: bigint, ...rest: bigint[]) {
  return rest.reduce(
    (current, value) => (value < current ? value : current),
    first,
  );
}

function assertNonNegativeBigint(value: bigint, name: string) {
  if (value < 0n) {
    throw new Error(`${name} must be non-negative`);
  }
}

function assertBasisPointsLike(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}
