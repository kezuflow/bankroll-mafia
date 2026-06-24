import type { FastifyPluginAsync } from "fastify";

import { heistDetailRoutes } from "./routes/detail.js";
import { heistIntentRoutes } from "./routes/intent.js";
import { heistPaymentRoutes } from "./routes/payment.js";
import { heistSettlementRoutes } from "./routes/settlement.js";
import { heistStatusRoutes } from "./routes/status.js";

export const heistRoutes: FastifyPluginAsync = async (app) => {
  await app.register(heistStatusRoutes);
  await app.register(heistIntentRoutes);
  await app.register(heistDetailRoutes);
  await app.register(heistPaymentRoutes);
  await app.register(heistSettlementRoutes);
};
