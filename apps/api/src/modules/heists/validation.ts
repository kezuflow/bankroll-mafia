import { crewConfigs, tierConfigs } from "@bankroll/game-config";
import type { CrewId, HeistTier } from "@bankroll/shared-types";
import { z } from "zod";

const tierIds = tierConfigs.map((tier) => tier.id) as [HeistTier, ...HeistTier[]];
const crewIds = crewConfigs.map((crew) => crew.id) as [CrewId, ...CrewId[]];

export const heistIntentSchema = z.object({
  tier: z.enum(tierIds),
  targetId: z.string().min(1).max(64),
  crewIds: z.array(z.enum(crewIds)).length(4),
  heistCostBaseUnits: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => BigInt(value)),
  idempotencyKey: z.string().uuid(),
}).strict();

export function validateHeistIntentBusinessRules(
  input: z.infer<typeof heistIntentSchema>,
) {
  const tier = tierConfigs.find((config) => config.id === input.tier);

  if (!tier) {
    throw new Error("Unknown tier");
  }

  const uniqueCrewIds = new Set(input.crewIds);

  if (uniqueCrewIds.size !== input.crewIds.length) {
    throw new Error("Crew IDs must be unique");
  }

  if (
    input.heistCostBaseUnits < tier.minCostBaseUnits ||
    input.heistCostBaseUnits > tier.maxCostBaseUnits
  ) {
    throw new Error(
      `Heist cost is outside ${tier.label} tier bounds ${tier.minCostBaseUnits}-${tier.maxCostBaseUnits}`,
    );
  }

  return tier;
}
