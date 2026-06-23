import type { FastifyPluginAsync } from "fastify";
import {
  SOL,
  tierConfigs,
  type TierConfig,
} from "@bankroll/game-config";
import {
  calculateDailyVaultPayoutCap,
  calculateVaultPayout,
} from "@bankroll/economy";

import { bigintToString } from "../../lib/serialization.js";

export const vaultRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "vaults",
    implemented: true,
    source: "static_dev_projection",
  }));

  app.get("/", async () =>
    bigintToString({
      vaults: tierConfigs.map((tier) => projectVaultStatus(tier)),
    }),
  );
};

function projectVaultStatus(tier: TierConfig) {
  const projectedPool = getProjectedVaultPool(tier.id);
  const dailyCap = calculateDailyVaultPayoutCap(
    projectedPool,
    tier.dailyVaultPercentBasisPoints,
    tier.absoluteDailyVaultCapBaseUnits,
  );
  const maxPayoutAtMaxEntry = calculateVaultPayout({
    tierVaultPoolBaseUnits: projectedPool,
    heistCostBaseUnits: tier.maxCostBaseUnits,
    vaultPercentBasisPoints: 100,
    maxMultiplierBasisPoints: tier.vaultMaxMultiplierBasisPoints,
    remainingDailyPayoutCapBaseUnits: dailyCap,
  });

  return {
    tier: tier.id,
    label: tier.label,
    projectedPoolBaseUnits: projectedPool,
    dailyPayoutCapBaseUnits: dailyCap,
    dailyPayoutUsedBaseUnits: 0n,
    dailyPayoutRemainingBaseUnits: dailyCap,
    maxPayoutAtMaxEntryBaseUnits: maxPayoutAtMaxEntry,
    source: "placeholder_until_sol_vault_indexer",
  };
}

function getProjectedVaultPool(tier: TierConfig["id"]) {
  switch (tier) {
    case "street":
      return 100n * SOL;
    case "crew":
      return 500n * SOL;
    case "boss":
      return 2_500n * SOL;
    case "highroller":
      return 10_000n * SOL;
  }
}
