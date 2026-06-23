import type { FastifyPluginAsync } from "fastify";

import { assertOutcomeTableComplete, generateTrustedOutcome } from "./service.js";

export const rngRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "rng",
    implemented: true,
    mode: "trusted-backend",
  }));

  app.get("/health", async () => {
    assertOutcomeTableComplete();

    return {
      ok: true,
      mode: "trusted-backend",
    };
  });

  app.post("/dev/roll", async () => {
    if (process.env.NODE_ENV === "production") {
      return {
        error: "dev roll disabled in production",
      };
    }

    return generateTrustedOutcome();
  });
};
