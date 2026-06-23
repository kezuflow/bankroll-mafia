import { describe, expect, it } from "vitest";

import {
  assertOutcomeTableComplete,
  generateTrustedOutcome,
  selectOutcomeFromRoll,
} from "./service.js";

describe("trusted RNG service", () => {
  it("has a complete outcome table", () => {
    expect(() => assertOutcomeTableComplete()).not.toThrow();
  });

  it("selects exact probability boundaries", () => {
    expect(selectOutcomeFromRoll(0).outcome).toBe("vault_jackpot");
    expect(selectOutcomeFromRoll(99).outcome).toBe("vault_jackpot");
    expect(selectOutcomeFromRoll(100).outcome).toBe("full_success");
    expect(selectOutcomeFromRoll(3_999).outcome).toBe("full_success");
    expect(selectOutcomeFromRoll(4_000).outcome).toBe("partial_success");
    expect(selectOutcomeFromRoll(6_999).outcome).toBe("partial_success");
    expect(selectOutcomeFromRoll(7_000).outcome).toBe("soft_fail");
    expect(selectOutcomeFromRoll(8_999).outcome).toBe("soft_fail");
    expect(selectOutcomeFromRoll(9_000).outcome).toBe("arrested");
    expect(selectOutcomeFromRoll(9_999).outcome).toBe("arrested");
  });

  it("rejects out-of-range rolls", () => {
    expect(() => selectOutcomeFromRoll(-1)).toThrow();
    expect(() => selectOutcomeFromRoll(10_000)).toThrow();
    expect(() => selectOutcomeFromRoll(1.5)).toThrow();
  });

  it("generates runtime outcomes inside the table", () => {
    const outcome = generateTrustedOutcome();

    expect([
      "vault_jackpot",
      "full_success",
      "partial_success",
      "soft_fail",
      "arrested",
    ]).toContain(outcome.outcome);
    expect(outcome.rollBasisPoints).toBeGreaterThanOrEqual(0);
    expect(outcome.rollBasisPoints).toBeLessThan(10_000);
  });
});

