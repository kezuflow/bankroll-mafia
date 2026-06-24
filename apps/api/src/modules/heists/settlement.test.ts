import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { SOL, tierConfigs } from "@bankroll/game-config";

import {
  calculateSettlementPayout,
  settleHeistIntent,
  type SettlementTransport,
} from "./settlement.js";
import { createMemoryHeistForTest } from "./store.js";

describe("heist settlement", () => {
  it("calculates normal outcome payouts from lamport inputs", () => {
    const street = tierConfigs[0]!;

    expect(
      calculateSettlementPayout({
        outcome: "full_success",
        heistCostBaseUnits: 10n * SOL,
        tierConfig: street,
        vaultPoolBaseUnits: 100n * SOL,
        remainingDailyVaultCapBaseUnits: 10n * SOL,
      }).payoutBaseUnits,
    ).toBe(12n * SOL);

    expect(
      calculateSettlementPayout({
        outcome: "partial_success",
        heistCostBaseUnits: 10n * SOL,
        tierConfig: street,
        vaultPoolBaseUnits: 100n * SOL,
        remainingDailyVaultCapBaseUnits: 10n * SOL,
      }).payoutBaseUnits,
    ).toBe(6n * SOL);
  });

  it("caps vault jackpot payouts by tier daily budget", () => {
    const street = tierConfigs[0]!;
    const payout = calculateSettlementPayout({
      outcome: "vault_jackpot",
      heistCostBaseUnits: 10n * SOL,
      tierConfig: street,
      vaultPoolBaseUnits: 10_000n * SOL,
      remainingDailyVaultCapBaseUnits: 5n * SOL,
    });

    expect(payout.payoutBaseUnits).toBe(5n * SOL);
    expect(payout.vaultPayoutBaseUnits).toBe(5n * SOL);
  });

  it("settles a paid heist once and returns the stored result on retry", async () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const heist = createMemoryHeistForTest({
      walletAddress: wallet,
      tier: "street",
      targetId: "corner-bank",
      crewIds: ["driver", "hacker", "lockpick", "lookout"],
      heistCostBaseUnits: 10n * SOL,
      idempotencyKey: "77777777-7777-4777-8777-777777777777",
      status: "paid",
      paymentSignature: "payment-signature",
      paymentVerifiedAt: new Date(),
    });
    const calls = {
      build: 0,
      submit: 0,
    };
    const transport: SettlementTransport = {
      async buildSignedSettlement() {
        calls.build += 1;

        return {
          signature: "settlement-signature",
          transactionBase64: "signed-transaction",
        };
      },
      async submitSignedSettlement() {
        calls.submit += 1;

        return "settlement-signature";
      },
    };

    const first = await settleHeistIntent({
      heistId: heist.id,
      transport,
      vaultAvailableBaseUnits: 1_000n * SOL,
    });
    const second = await settleHeistIntent({
      heistId: heist.id,
      transport,
      vaultAvailableBaseUnits: 1_000n * SOL,
    });

    expect(first.status).toBe("settled");
    expect(second.status).toBe("settled");
    expect(second.outcome).toBe(first.outcome);
    expect(calls).toEqual({
      build: 1,
      submit: 1,
    });
  });
});
