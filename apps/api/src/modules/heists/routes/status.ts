import type { FastifyPluginAsync } from "fastify";

export const heistStatusRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "heists",
    implemented: true,
    transactionPreparation: "program_enter_heist",
    onchainEntry: "implemented_program_enter_heist",
    settlement: "program_settle_heist",
  }));
};
