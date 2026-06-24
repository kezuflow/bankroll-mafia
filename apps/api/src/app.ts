import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { apiModules } from "./modules/index.js";

export function createApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  void app.register(helmet);
  void app.register(cors, {
    credentials: true,
    origin: getAllowedOrigins(),
  });
  void app.register(cookie, {
    secret: getCookieSecret(),
  });

  app.get("/health", async () => ({
    ok: true,
    service: "bankroll-mafia-api",
    environment: process.env.NODE_ENV ?? "development",
  }));

  for (const module of apiModules) {
    void app.register(module.routes, { prefix: module.prefix });
  }

  return app;
}

function getCookieSecret() {
  const secret = process.env.COOKIE_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("COOKIE_SECRET is required in production");
  }

  return "bankroll-mafia-local-cookie-secret-change-before-prod";
}

function getAllowedOrigins() {
  const origins =
    process.env.WEB_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000";

  return origins.split(",").map((origin) => origin.trim());
}
