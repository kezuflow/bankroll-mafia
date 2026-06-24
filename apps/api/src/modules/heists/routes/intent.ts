import type { FastifyPluginAsync } from "fastify";

import { bigintToString } from "../../../lib/serialization.js";
import { getRequestSession } from "../../auth/session.js";
import { createOrGetHeistIntent } from "../store.js";
import {
  heistIntentSchema,
  validateHeistIntentBusinessRules,
} from "../validation.js";

export const heistIntentRoutes: FastifyPluginAsync = async (app) => {
  app.post("/intent", async (request, reply) => {
    const session = await getRequestSession(request);

    if (!session) {
      return reply.code(401).send({
        error: "Authentication required",
      });
    }

    const parsed = heistIntentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid heist intent",
        issues: parsed.error.issues,
      });
    }

    try {
      const tier = validateHeistIntentBusinessRules(parsed.data);
      const result = await createOrGetHeistIntent({
        ...parsed.data,
        walletAddress: session.walletAddress,
      });

      return reply.code(result.reused ? 200 : 201).send(
        bigintToString({
          ...result.record,
          createdAt: result.record.createdAt.toISOString(),
          tierConfig: tier,
          reused: result.reused,
        }),
      );
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid heist intent",
      });
    }
  });
};
