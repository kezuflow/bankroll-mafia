import type { TierConfig } from "@bankroll/game-config";
import { CircleDollarSign, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { basisPointsToPercent, formatSol } from "./format";

export function VaultControlCard({ selectedTier }: { selectedTier: TierConfig }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault Control</CardTitle>
        <CardDescription>
          Caps protect the bankroll when lucky streaks cluster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          <CircleDollarSign className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Daily payout cap</p>
            <p className="text-sm text-muted-foreground">
              min(
              {basisPointsToPercent(selectedTier.dailyVaultPercentBasisPoints)}{" "}
              of day-start vault,{" "}
              {formatSol(selectedTier.absoluteDailyVaultCapBaseUnits)})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Streak-safe jackpot</p>
            <p className="text-sm text-muted-foreground">
              Vault hits convert down if the daily budget is empty.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
