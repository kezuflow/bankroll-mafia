import { outcomeTable } from "@bankroll/game-config";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { outcomeDescriptions } from "./display-config";
import { basisPointsToPercent } from "./format";

export function OutcomeTableCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Outcome Table</CardTitle>
        <CardDescription>
          Five outcomes keep the experience from feeling binary.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {outcomeTable.map((outcome) => (
          <div
            key={outcome.id}
            className="rounded-lg border border-border bg-secondary/40 p-3"
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="font-semibold">{outcome.label}</p>
              <Badge
                variant={outcome.id === "vault_jackpot" ? "default" : "outline"}
              >
                {basisPointsToPercent(outcome.probabilityBasisPoints)}
              </Badge>
            </div>
            <p className="text-sm leading-5 text-muted-foreground">
              {outcomeDescriptions[outcome.id]}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
