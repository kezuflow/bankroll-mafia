import type { FastifyPluginAsync } from "fastify";

import { adminRoutes } from "./admin/index.js";
import { authRoutes } from "./auth/index.js";
import { economyRoutes } from "./economy/index.js";
import { heistRoutes } from "./heists/index.js";
import { ledgerRoutes } from "./ledger/index.js";
import { rngRoutes } from "./rng/index.js";
import { treasuryRoutes } from "./treasury/index.js";
import { userRoutes } from "./users/index.js";
import { vaultRoutes } from "./vaults/index.js";
import { walletRoutes } from "./wallets/index.js";

export interface ApiModule {
  name: string;
  prefix: `/${string}`;
  routes: FastifyPluginAsync;
}

export const apiModules = [
  {
    name: "auth",
    prefix: "/auth",
    routes: authRoutes,
  },
  {
    name: "wallets",
    prefix: "/wallets",
    routes: walletRoutes,
  },
  {
    name: "users",
    prefix: "/users",
    routes: userRoutes,
  },
  {
    name: "heists",
    prefix: "/heists",
    routes: heistRoutes,
  },
  {
    name: "vaults",
    prefix: "/vaults",
    routes: vaultRoutes,
  },
  {
    name: "economy",
    prefix: "/economy",
    routes: economyRoutes,
  },
  {
    name: "ledger",
    prefix: "/ledger",
    routes: ledgerRoutes,
  },
  {
    name: "rng",
    prefix: "/rng",
    routes: rngRoutes,
  },
  {
    name: "treasury",
    prefix: "/treasury",
    routes: treasuryRoutes,
  },
  {
    name: "admin",
    prefix: "/admin",
    routes: adminRoutes,
  },
] as const satisfies ApiModule[];
