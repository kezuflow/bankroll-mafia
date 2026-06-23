import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";

describe("heist routes", () => {
  it("creates and reuses a valid heist intent by idempotency key", async () => {
    const app = createApp();
    const cookie = await createAuthCookie(app);
    const payload = {
      tier: "street",
      targetId: "corner-bank",
      crewIds: ["driver", "hacker", "lockpick", "lookout"],
      heistCostBaseUnits: "10000000",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    };

    const created = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie },
      payload,
    });
    const reused = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie },
      payload,
    });

    expect(created.statusCode).toBe(201);
    expect(reused.statusCode).toBe(200);
    expect(created.json<{ id: string }>().id).toBe(
      reused.json<{ id: string }>().id,
    );

    await app.close();
  });

  it("scopes idempotency keys and heist reads to the authenticated wallet", async () => {
    const app = createApp();
    const firstCookie = await createAuthCookie(app);
    const secondCookie = await createAuthCookie(app);
    const payload = {
      tier: "street",
      targetId: "corner-bank",
      crewIds: ["driver", "hacker", "lockpick", "lookout"],
      heistCostBaseUnits: "10000000",
      idempotencyKey: "66666666-6666-4666-8666-666666666666",
    };

    const first = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie: firstCookie },
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie: secondCookie },
      payload,
    });
    const crossWalletRead = await app.inject({
      method: "GET",
      url: `/heists/${first.json<{ id: string }>().id}`,
      headers: { cookie: secondCookie },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json<{ id: string }>().id).not.toBe(
      second.json<{ id: string }>().id,
    );
    expect(crossWalletRead.statusCode).toBe(404);

    await app.close();
  });

  it("rejects duplicate crews and out-of-tier heist costs", async () => {
    const app = createApp();
    const cookie = await createAuthCookie(app);

    const duplicateCrew = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie },
      payload: {
        tier: "street",
        targetId: "corner-bank",
        crewIds: ["driver", "driver", "lockpick", "lookout"],
        heistCostBaseUnits: "10000000",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      },
    });
    const tooExpensive = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie },
      payload: {
        tier: "street",
        targetId: "corner-bank",
        crewIds: ["driver", "hacker", "lockpick", "lookout"],
        heistCostBaseUnits: "100000000",
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      },
    });

    expect(duplicateCrew.statusCode).toBe(400);
    expect(tooExpensive.statusCode).toBe(400);

    await app.close();
  });

  it("requires an authenticated session to create an intent", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/heists/intent",
      payload: {
        tier: "street",
        targetId: "corner-bank",
        crewIds: ["driver", "hacker", "lockpick", "lookout"],
        heistCostBaseUnits: "10000000",
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
      },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("rejects malformed heist ids with a controlled response", async () => {
    const app = createApp();
    const cookie = await createAuthCookie(app);
    const response = await app.inject({
      method: "GET",
      url: "/heists/not-a-uuid",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("rejects settlement before payment is verified", async () => {
    const app = createApp();
    const cookie = await createAuthCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie },
      payload: {
        tier: "street",
        targetId: "corner-bank",
        crewIds: ["driver", "hacker", "lockpick", "lookout"],
        heistCostBaseUnits: "10000000",
        idempotencyKey: "88888888-8888-4888-8888-888888888888",
      },
    });
    const response = await app.inject({
      method: "POST",
      url: `/heists/${created.json<{ id: string }>().id}/settle`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("rejects client-submitted payout, outcome, and vault fields", async () => {
    const app = createApp();
    const cookie = await createAuthCookie(app);
    const response = await app.inject({
      method: "POST",
      url: "/heists/intent",
      headers: { cookie },
      payload: {
        tier: "street",
        targetId: "corner-bank",
        crewIds: ["driver", "hacker", "lockpick", "lookout"],
        heistCostBaseUnits: "10000000",
        idempotencyKey: "55555555-5555-4555-8555-555555555555",
        payoutBaseUnits: "999999999999",
        outcome: "vault_jackpot",
        vaultPayoutBaseUnits: "999999999999",
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});

async function createAuthCookie(app: ReturnType<typeof createApp>) {
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
  const signature = nacl.sign.detached(
    new TextEncoder().encode(noncePayload.message),
    wallet.secretKey,
  );
  const verifyResponse = await app.inject({
    method: "POST",
    url: "/auth/verify",
    payload: {
      walletAddress,
      domain: noncePayload.domain,
      nonce: noncePayload.nonce,
      signature: bs58.encode(signature),
    },
  });
  const setCookie = verifyResponse.headers["set-cookie"];

  if (Array.isArray(setCookie)) {
    return setCookie[0]!.split(";")[0]!;
  }

  if (typeof setCookie === "string") {
    return setCookie.split(";")[0]!;
  }

  throw new Error("Missing auth cookie");
}
