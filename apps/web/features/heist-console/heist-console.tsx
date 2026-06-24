"use client";

import { tierConfigs } from "@bankroll/game-config";

import { useHeistUiStore } from "@/stores/heist-ui-store";

import { CrewCard } from "./crew-card";
import { HeistConsoleHeader } from "./heist-console-header";
import { HeistSlipCard } from "./heist-slip-card";
import { JobTierCard } from "./job-tier-card";
import { OutcomeTableCard } from "./outcome-table-card";
import { TargetCard } from "./target-card";
import { VaultControlCard } from "./vault-control-card";

export function HeistConsole() {
  const selectedTierId = useHeistUiStore((state) => state.selectedTierId);
  const selectedTargetId = useHeistUiStore((state) => state.selectedTargetId);
  const selectedCrewIds = useHeistUiStore((state) => state.selectedCrewIds);
  const setSelectedTierId = useHeistUiStore((state) => state.setSelectedTierId);
  const setSelectedTargetId = useHeistUiStore(
    (state) => state.setSelectedTargetId,
  );
  const toggleCrewId = useHeistUiStore((state) => state.toggleCrewId);
  const selectedTier = tierConfigs.find((tier) => tier.id === selectedTierId)!;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <HeistConsoleHeader />

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <JobTierCard
              selectedTierId={selectedTierId}
              onTierChange={setSelectedTierId}
            />

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <TargetCard
                selectedTargetId={selectedTargetId}
                onTargetChange={setSelectedTargetId}
              />
              <CrewCard
                selectedCrewIds={selectedCrewIds}
                onCrewToggle={toggleCrewId}
              />
            </div>
          </section>

          <aside className="space-y-6">
            <HeistSlipCard selectedTier={selectedTier} />
            <OutcomeTableCard />
            <VaultControlCard selectedTier={selectedTier} />
          </aside>
        </div>
      </section>
    </main>
  );
}
