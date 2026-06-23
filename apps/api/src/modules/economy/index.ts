import type { FastifyPluginAsync } from "fastify";
import { crewConfigs, outcomeTable, tierConfigs } from "@bankroll/game-config";

export const economyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "economy",
    implemented: true,
  }));

  app.get("/config", async () => ({
    tiers: stringifyBigints(tierConfigs),
    crews: crewConfigs,
    outcomes: outcomeTable,
  }));
};

function stringifyBigints<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifyBigints(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, stringifyBigints(entry)]),
    ) as T;
  }

  return value;
}
