import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";

describe("auth routes", () => {
  afterEach(() => {
    delete process.env.COOKIE_SECRET;
  });

  it("creates a nonce, verifies a Solana signature, and returns session state", async () => {
    process.env.COOKIE_SECRET = "test-cookie-secret";
    const app = createApp();
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();

    const nonceResponse = await app.inject({
      method: "POST",
      url: "/auth/nonce",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        walletAddress,
      },
    });
    const noncePayload = nonceResponse.json<{
      nonce: string;
      message: string;
      domain: string;
    }>();
    const signature = signMessage(noncePayload.message, wallet);

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: {
        walletAddress,
        domain: noncePayload.domain,
        nonce: noncePayload.nonce,
        signature,
      },
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.headers["set-cookie"]).toBeDefined();

    const cookie = extractCookie(verifyResponse.headers["set-cookie"]);
    const meResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        cookie,
      },
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      authenticated: true,
      walletAddress,
    });

    await app.close();
  });

  it("rejects replayed nonces", async () => {
    process.env.COOKIE_SECRET = "test-cookie-secret";
    const app = createApp();
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    const nonceResponse = await app.inject({
      method: "POST",
      url: "/auth/nonce",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        walletAddress,
      },
    });
    const noncePayload = nonceResponse.json<{
      nonce: string;
      message: string;
      domain: string;
    }>();
    const signature = signMessage(noncePayload.message, wallet);
    const payload = {
      walletAddress,
      domain: noncePayload.domain,
      nonce: noncePayload.nonce,
      signature,
    };

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/verify",
          payload,
        })
      ).statusCode,
    ).toBe(200);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/verify",
          payload,
        })
      ).statusCode,
    ).toBe(400);

    await app.close();
  });

  it("rejects invalid signatures", async () => {
    process.env.COOKIE_SECRET = "test-cookie-secret";
    const app = createApp();
    const wallet = Keypair.generate();
    const impostor = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    const nonceResponse = await app.inject({
      method: "POST",
      url: "/auth/nonce",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        walletAddress,
      },
    });
    const noncePayload = nonceResponse.json<{
      nonce: string;
      message: string;
      domain: string;
    }>();

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: {
        walletAddress,
        domain: noncePayload.domain,
        nonce: noncePayload.nonce,
        signature: signMessage(noncePayload.message, impostor),
      },
    });

    expect(verifyResponse.statusCode).toBe(401);

    await app.close();
  });

  it("rejects malformed wallet addresses and malformed signatures", async () => {
    process.env.COOKIE_SECRET = "test-cookie-secret";
    const app = createApp();
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();

    const invalidWalletResponse = await app.inject({
      method: "POST",
      url: "/auth/nonce",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        walletAddress: "not-a-solana-wallet",
      },
    });
    const nonceResponse = await app.inject({
      method: "POST",
      url: "/auth/nonce",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        walletAddress,
      },
    });
    const noncePayload = nonceResponse.json<{
      nonce: string;
      domain: string;
    }>();
    const malformedSignatureResponse = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: {
        walletAddress,
        domain: noncePayload.domain,
        nonce: noncePayload.nonce,
        signature: "not-base58-signature-that-is-long-enough!!!!",
      },
    });

    expect(invalidWalletResponse.statusCode).toBe(400);
    expect(malformedSignatureResponse.statusCode).toBe(401);

    await app.close();
  });

  it("rejects caller-controlled nonce domains", async () => {
    process.env.COOKIE_SECRET = "test-cookie-secret";
    const app = createApp();
    const wallet = Keypair.generate();
    const response = await app.inject({
      method: "POST",
      url: "/auth/nonce",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        walletAddress: wallet.publicKey.toBase58(),
        domain: "evil.example",
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("rejects nonce requests from non-allowlisted origins", async () => {
    process.env.COOKIE_SECRET = "test-cookie-secret";
    const app = createApp();
    const wallet = Keypair.generate();
    const response = await app.inject({
      method: "POST",
      url: "/auth/nonce",
      headers: {
        origin: "https://evil.example",
      },
      payload: {
        walletAddress: wallet.publicKey.toBase58(),
      },
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });
});

function signMessage(message: string, wallet: Keypair) {
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    wallet.secretKey,
  );

  return bs58.encode(signature);
}

function extractCookie(setCookie: string | string[] | number | undefined) {
  if (Array.isArray(setCookie)) {
    return setCookie[0]!.split(";")[0]!;
  }

  if (typeof setCookie === "string") {
    return setCookie.split(";")[0]!;
  }

  throw new Error("Missing set-cookie header");
}
