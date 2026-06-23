import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { adminRoutes } from "./modules/admin/index.js";
import { authRoutes } from "./modules/auth/index.js";
import { economyRoutes } from "./modules/economy/index.js";
import { heistRoutes } from "./modules/heists/index.js";
import { ledgerRoutes } from "./modules/ledger/index.js";
import { rngRoutes } from "./modules/rng/index.js";
import { treasuryRoutes } from "./modules/treasury/index.js";
import { userRoutes } from "./modules/users/index.js";
import { vaultRoutes } from "./modules/vaults/index.js";
import { walletRoutes } from "./modules/wallets/index.js";

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

  void app.register(authRoutes, { prefix: "/auth" });
  void app.register(walletRoutes, { prefix: "/wallets" });
  void app.register(userRoutes, { prefix: "/users" });
  void app.register(heistRoutes, { prefix: "/heists" });
  void app.register(vaultRoutes, { prefix: "/vaults" });
  void app.register(economyRoutes, { prefix: "/economy" });
  void app.register(ledgerRoutes, { prefix: "/ledger" });
  void app.register(rngRoutes, { prefix: "/rng" });
  void app.register(treasuryRoutes, { prefix: "/treasury" });
  void app.register(adminRoutes, { prefix: "/admin" });

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
