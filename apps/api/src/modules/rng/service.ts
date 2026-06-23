import { randomInt } from "node:crypto";

import { BASIS_POINTS, outcomeTable } from "@bankroll/game-config";
import type { OutcomeId } from "@bankroll/shared-types";

export interface RngOutcome {
  outcome: OutcomeId;
  rollBasisPoints: number;
}

export function generateTrustedOutcome(): RngOutcome {
  return selectOutcomeFromRoll(randomInt(BASIS_POINTS));
}

export function selectOutcomeFromRoll(rollBasisPoints: number): RngOutcome {
  if (
    !Number.isInteger(rollBasisPoints) ||
    rollBasisPoints < 0 ||
    rollBasisPoints >= BASIS_POINTS
  ) {
    throw new Error(`rollBasisPoints must be an integer from 0 to ${BASIS_POINTS - 1}`);
  }

  let cursor = 0;

  for (const outcome of outcomeTable) {
    cursor += outcome.probabilityBasisPoints;

    if (rollBasisPoints < cursor) {
      return {
        outcome: outcome.id,
        rollBasisPoints,
      };
    }
  }

  throw new Error("Outcome table probabilities do not cover full basis-point range");
}

export function assertOutcomeTableComplete() {
  const total = outcomeTable.reduce(
    (sum, outcome) => sum + outcome.probabilityBasisPoints,
    0,
  );

  if (total !== BASIS_POINTS) {
    throw new Error(`Outcome probabilities total ${total}, expected ${BASIS_POINTS}`);
  }
}

