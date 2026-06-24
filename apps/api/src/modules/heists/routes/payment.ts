import type { FastifyPluginAsync } from "fastify";

import { bigintToString } from "../../../lib/serialization.js";
import { getRequestSession } from "../../auth/session.js";
import { verifyHeistPaymentSignature } from "../payment.js";
import { getHeistIntent, markHeistPaymentVerified } from "../store.js";
import { heistParamsSchema, paymentBodySchema } from "./schemas.js";

export const heistPaymentRoutes: FastifyPluginAsync = async (app) => {
  app.post("/:id/payment", async (request, reply) => {
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

    const parsed = paymentBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payment confirmation",
        issues: parsed.error.issues,
      });
    }

    const record = await getHeistIntent(params.data.id);

    if (!record || record.walletAddress !== session.walletAddress) {
      return reply.code(404).send({
        error: "Heist intent not found",
      });
    }

    if (record.status !== "payment_pending") {
      return reply.code(409).send({
        error: "Heist is not waiting for payment",
      });
    }

    try {
      await verifyHeistPaymentSignature({
        signature: parsed.data.signature,
        walletAddress: session.walletAddress,
        tier: record.tier,
        targetId: record.targetId,
        crewIds: record.crewIds,
        idempotencyKey: record.idempotencyKey,
        heistCostBaseUnits: record.heistCostBaseUnits,
        notBefore: record.createdAt,
      });

      const updated = await markHeistPaymentVerified({
        id: record.id,
        paymentSignature: parsed.data.signature,
      });

      return reply.send(
        bigintToString({
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          paymentVerifiedAt: updated.paymentVerifiedAt?.toISOString(),
        }),
      );
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error
            ? error.message
            : "Payment verification failed",
      });
    }
  });
};
