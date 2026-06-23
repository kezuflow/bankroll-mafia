import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";

describe("economy routes", () => {
  it("returns shared economy config without raw bigint JSON values", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/economy/config",
    });
    const payload = response.json<{
      tiers: Array<{
        id: string;
        minCostBaseUnits: string;
      }>;
      crews: unknown[];
      outcomes: unknown[];
    }>();

    expect(response.statusCode).toBe(200);
    expect(payload.tiers[0]?.id).toBe("street");
    expect(typeof payload.tiers[0]?.minCostBaseUnits).toBe("string");
    expect(payload.crews).toHaveLength(8);
    expect(payload.outcomes).toHaveLength(5);

    await app.close();
  });
});

