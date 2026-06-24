import { tierConfigs } from "@bankroll/game-config";
import type { HeistTier } from "@bankroll/shared-types";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { vaultDisplayByTier } from "./display-config";
import { basisPointsToPercent, formatSol } from "./format";
import { Metric } from "./metric";

export function JobTierCard({
  selectedTierId,
  onTierChange,
}: {
  selectedTierId: HeistTier;
  onTierChange: (tier: HeistTier) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Choose The Job</CardTitle>
            <CardDescription>
              Pick a bankroll tier, target profile, and crew volatility before
              signing the heist.
            </CardDescription>
          </div>
          <Badge variant="warning">RTP capped below 100%</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          value={selectedTierId}
          onValueChange={(value) => {
            onTierChange(value as HeistTier);
          }}
        >
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            {tierConfigs.map((tier) => (
              <TabsTrigger key={tier.id} value={tier.id}>
                {tier.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tierConfigs.map((tier) => (
            <TabsContent key={tier.id} value={tier.id}>
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric
                  label="Heist Cost"
                  value={`${formatSol(tier.minCostBaseUnits)}-${formatSol(tier.maxCostBaseUnits)}`}
                />
                <Metric
                  label="Target RTP"
                  value={`${basisPointsToPercent(tier.minRtpBasisPoints)}-${basisPointsToPercent(tier.maxRtpBasisPoints)}`}
                />
                <Metric
                  label="Vault Cap"
                  value={`${tier.vaultMaxMultiplierBasisPoints / 10_000}x`}
                />
                <Metric label="Vault Pool" value={vaultDisplayByTier[tier.id]} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
