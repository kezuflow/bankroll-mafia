import type { FastifyPluginAsync } from "fastify";

export const ledgerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "ledger",
    implemented: false,
  }));
};

