import type { FastifyPluginAsync } from "fastify";

import { bigintToString } from "../../../lib/serialization.js";
import { getRequestSession } from "../../auth/session.js";
import { settleHeistIntent } from "../settlement.js";
import { getHeistIntent } from "../store.js";
import { heistParamsSchema } from "./schemas.js";

export const heistSettlementRoutes: FastifyPluginAsync = async (app) => {
  app.post("/:id/settle", async (request, reply) => {
    const session = await getRequestSession(request);

    if (!session) {
      return reply.code(401).send({
        error: "Authentication required",
      });
    }

    const params = heistParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({
        error: "Invalid heist id",
        issues: params.error.issues,
      });
    }

    const record = await getHeistIntent(params.data.id);

    if (!record || record.walletAddress !== session.walletAddress) {
      return reply.code(404).send({
        error: "Heist intent not found",
      });
    }

    try {
      const settled = await settleHeistIntent({
        heistId: record.id,
      });

      return reply.send(
        bigintToString({
          ...settled,
          createdAt: settled.createdAt.toISOString(),
          paymentVerifiedAt: settled.paymentVerifiedAt?.toISOString(),
          settledAt: settled.settledAt?.toISOString(),
        }),
      );
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Settlement failed",
      });
    }
  });
};
