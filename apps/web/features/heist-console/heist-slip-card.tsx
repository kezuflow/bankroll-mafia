import type { TierConfig } from "@bankroll/game-config";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrepareHeistButton } from "@/components/prepare-heist-button";

import { basisPointsToPercent, formatSol } from "./format";
import { Metric } from "./metric";

export function HeistSlipCard({ selectedTier }: { selectedTier: TierConfig }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heist Slip</CardTitle>
        <CardDescription>
          The API will prepare the Solana transaction. The wallet signs the
          final wager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Entry" value={formatSol(selectedTier.maxCostBaseUnits)} />
          <Metric label="Vault Hit" value="1%" />
          <Metric
            label="Max Vault"
            value={`${selectedTier.vaultMaxMultiplierBasisPoints / 10_000}x`}
          />
          <Metric
            label="Daily Room"
            value={formatSol(selectedTier.absoluteDailyVaultCapBaseUnits)}
          />
        </div>
        <PrepareHeistButton />
        <p className="text-center text-xs text-muted-foreground">
          No predeposit. Each heist is signed by the player wallet and enters
          the program-owned tier vault.
        </p>
        <p className="sr-only">
          Daily vault cap is{" "}
          {basisPointsToPercent(selectedTier.dailyVaultPercentBasisPoints)}.
        </p>
      </CardContent>
    </Card>
  );
}
