import type { FastifyPluginAsync } from "fastify";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "admin",
    implemented: false,
  }));
};

