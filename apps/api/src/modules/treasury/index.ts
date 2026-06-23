import type { FastifyPluginAsync } from "fastify";

export const treasuryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "treasury",
    implemented: false,
  }));
};

