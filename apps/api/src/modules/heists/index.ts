import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { bigintToString } from "../../lib/serialization.js";
import { getRequestSession } from "../auth/session.js";
import { verifyHeistPaymentSignature } from "./payment.js";
import { settleHeistIntent } from "./settlement.js";
import {
  createOrGetHeistIntent,
  getHeistIntent,
  markHeistPaymentVerified,
} from "./store.js";
import {
  heistIntentSchema,
  validateHeistIntentBusinessRules,
} from "./validation.js";

export const heistRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "heists",
    implemented: true,
    transactionPreparation: "native_sol_payment",
    settlement: "trusted_backend_sol_payout",
  }));

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

    if (!record) {
      return reply.code(404).send({
        error: "Heist intent not found",
      });
    }

    if (record.walletAddress !== session.walletAddress) {
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
          error instanceof Error ? error.message : "Payment verification failed",
      });
    }
  });

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

const paymentBodySchema = z
  .object({
    signature: z.string().min(32).max(128),
  })
  .strict();

const heistParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();
