import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";

describe("vault routes", () => {
  it("returns projected vault state with stringified bigint values", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/vaults",
    });
    const payload = response.json<{
      vaults: Array<{
        tier: string;
        projectedPoolBaseUnits: string;
        dailyPayoutRemainingBaseUnits: string;
      }>;
    }>();

    expect(response.statusCode).toBe(200);
    expect(payload.vaults).toHaveLength(4);
    expect(payload.vaults[0]?.tier).toBe("street");
    expect(typeof payload.vaults[0]?.projectedPoolBaseUnits).toBe("string");
    expect(typeof payload.vaults[0]?.dailyPayoutRemainingBaseUnits).toBe(
      "string",
    );

    await app.close();
  });
});

