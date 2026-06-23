import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  consumeNonce,
  createNonceRecord,
  createSession,
  revokeSession,
} from "./store.js";
import {
  assertValidSolanaAddress,
  verifySolanaMessageSignature,
} from "./verify.js";
import { getRequestSession, sessionCookieName } from "./session.js";

const nonceBodySchema = z
  .object({
    walletAddress: z.string().min(32),
  })
  .strict();

const verifyBodySchema = z
  .object({
    walletAddress: z.string().min(32),
    domain: z.string().min(1),
    nonce: z.string().min(16),
    signature: z.string().min(32),
  })
  .strict();

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => ({
    module: "auth",
    implemented: true,
  }));

  app.post("/nonce", async (request, reply) => {
    const parsed = nonceBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid nonce request",
        issues: parsed.error.issues,
      });
    }

    const walletAddress = tryParseWalletAddress(parsed.data.walletAddress);

    if (!walletAddress.ok) {
      return reply.code(400).send({
        error: walletAddress.error,
      });
    }

    const domain = getRequestDomain(
      request.headers.origin ?? request.headers.host,
    );

    if (!isAllowedAuthDomain(domain)) {
      return reply.code(403).send({
        error: "Auth domain is not allowed",
      });
    }

    const record = await createNonceRecord(walletAddress.value, domain);

    return reply.send({
      walletAddress: walletAddress.value,
      domain,
      nonce: record.nonce,
      message: record.message,
      expiresAt: record.expiresAt.toISOString(),
    });
  });

  app.post("/verify", async (request, reply) => {
    const parsed = verifyBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid verify request",
        issues: parsed.error.issues,
      });
    }

    const body = parsed.data;
    const walletAddress = tryParseWalletAddress(body.walletAddress);

    if (!walletAddress.ok) {
      return reply.code(400).send({
        error: walletAddress.error,
      });
    }

    const record = await tryConsumeNonce(
      body.nonce,
      walletAddress.value,
      body.domain,
    );

    if (!record.ok) {
      return reply.code(400).send({
        error: record.error,
      });
    }

    const valid = verifySolanaMessageSignature({
      walletAddress: walletAddress.value,
      message: record.value.message,
      signature: body.signature,
    });

    if (!valid) {
      return reply.code(401).send({
        error: "Invalid signature",
      });
    }

    const session = await createSession(walletAddress.value);

    reply.setCookie(sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      signed: true,
      path: "/",
      expires: session.record.expiresAt,
    });

    return reply.send({
      walletAddress: walletAddress.value,
      expiresAt: session.record.expiresAt.toISOString(),
    });
  });

  app.get("/me", async (request, reply) => {
    const session = await getRequestSession(request);

    if (!session) {
      return reply.code(401).send({
        authenticated: false,
      });
    }

    return reply.send({
      authenticated: true,
      walletAddress: session.walletAddress,
      expiresAt: session.expiresAt.toISOString(),
    });
  });

  app.post("/logout", async (request, reply) => {
    const token = request.unsignCookie(
      request.cookies[sessionCookieName] ?? "",
    );

    if (token.valid) {
      await revokeSession(token.value);
    }

    reply.clearCookie(sessionCookieName, {
      path: "/",
    });

    return reply.send({
      ok: true,
    });
  });
};

async function tryConsumeNonce(
  nonce: string,
  walletAddress: string,
  domain: string,
) {
  try {
    return {
      ok: true as const,
      value: await consumeNonce(nonce, walletAddress, domain),
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Invalid nonce",
    };
  }
}

function tryParseWalletAddress(walletAddress: string) {
  try {
    return {
      ok: true as const,
      value: assertValidSolanaAddress(walletAddress),
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Invalid Solana wallet address",
    };
  }
}

function getRequestDomain(domainHeader: string | undefined) {
  if (!domainHeader) {
    return "localhost";
  }

  try {
    return new URL(domainHeader).host;
  } catch {
    return domainHeader;
  }
}

function isAllowedAuthDomain(domain: string) {
  return getAllowedAuthDomains().has(domain);
}

function getAllowedAuthDomains() {
  const origins =
    process.env.WEB_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000";

  return new Set(
    origins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => {
        try {
          return new URL(origin).host;
        } catch {
          return origin;
        }
      }),
  );
}
