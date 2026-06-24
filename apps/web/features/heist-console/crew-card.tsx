import { crewConfigs } from "@bankroll/game-config";
import type { CrewId } from "@bankroll/shared-types";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { crewIcons } from "./display-config";

export function CrewCard({
  selectedCrewIds,
  onCrewToggle,
}: {
  selectedCrewIds: CrewId[];
  onCrewToggle: (crewId: CrewId) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assemble Crew</CardTitle>
        <CardDescription>
          Pick four roles. Each perk must carry an economic tradeoff.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {crewConfigs.map((crew) => {
            const Icon = crewIcons[crew.id];
            const selected = selectedCrewIds.includes(crew.id);

            return (
              <button
                type="button"
                key={crew.id}
                className="flex min-h-24 gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  onCrewToggle(crew.id);
                }}
                disabled={!selected && selectedCrewIds.length >= 4}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-semibold">{crew.label}</p>
                    {selected ? <Badge variant="success">Picked</Badge> : null}
                  </div>
                  <p className="text-sm leading-5 text-muted-foreground">
                    {crew.effect} {crew.tradeoff}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
