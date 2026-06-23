import type { FastifyPluginAsync } from "fastify";

export const walletRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "wallets",
    implemented: false,
  }));
};

