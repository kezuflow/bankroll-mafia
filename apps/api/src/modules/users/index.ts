import type { FastifyPluginAsync } from "fastify";

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "users",
    implemented: false,
  }));
};

