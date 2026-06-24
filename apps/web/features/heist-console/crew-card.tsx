import { crewConfigs } from "@bankroll/game-config";
import type { CrewId } from "@bankroll/shared-types";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { crewIcons, crewImageById } from "./display-config";

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
                className="grid min-h-36 grid-cols-[80px_1fr] gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  onCrewToggle(crew.id);
                }}
                disabled={!selected && selectedCrewIds.length >= 4}
              >
                <div className="relative h-28 overflow-hidden rounded-md border border-border bg-background">
                  <Image
                    src={crewImageById[crew.id]}
                    alt={`${crew.label} crew portrait`}
                    fill
                    loading="eager"
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
                  <div className="absolute bottom-1 left-1 flex h-7 w-7 items-center justify-center rounded-sm bg-background/90 text-primary shadow-sm backdrop-blur">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
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
