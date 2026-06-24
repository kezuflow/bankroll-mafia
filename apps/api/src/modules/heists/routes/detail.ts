import type { FastifyPluginAsync } from "fastify";

import { bigintToString } from "../../../lib/serialization.js";
import { getRequestSession } from "../../auth/session.js";
import { getHeistIntent } from "../store.js";
import { heistParamsSchema } from "./schemas.js";

export const heistDetailRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:id", async (request, reply) => {
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

    return reply.send(
      bigintToString({
        ...record,
        createdAt: record.createdAt.toISOString(),
      }),
    );
  });
};
