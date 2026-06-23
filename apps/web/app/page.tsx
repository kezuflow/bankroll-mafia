"use client";

import {
  Car,
  CircleDollarSign,
  Crosshair,
  Eye,
  Gavel,
  KeyRound,
  Laptop,
  Shield,
  Skull,
  Sparkles,
  UserRoundCheck,
  Vault,
} from "lucide-react";
import { crewConfigs, outcomeTable, SOL, tierConfigs } from "@bankroll/game-config";
import type { CrewId, HeistTier } from "@bankroll/shared-types";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrepareHeistButton } from "@/components/prepare-heist-button";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useHeistUiStore } from "@/stores/heist-ui-store";

const vaultDisplayByTier = {
  street: "100 SOL",
  crew: "500 SOL",
  boss: "2,500 SOL",
  highroller: "10,000 SOL",
} as const;

const crewIcons = {
  driver: Car,
  hacker: Laptop,
  insider: UserRoundCheck,
  cleaner: Shield,
  enforcer: Skull,
  lockpick: KeyRound,
  lookout: Eye,
  lawyer: Gavel,
} satisfies Record<CrewId, typeof Car>;

const outcomeDescriptions = {
  vault_jackpot: "Capped by vault, entry, and daily tier budget.",
  full_success: "Main payout with normal heist success.",
  partial_success: "Smaller payout after missing the main vault.",
  soft_fail: "Escaped with little value.",
  arrested: "Worst result, but still priced in RTP.",
} as const;

export default function Home() {
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
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Vault className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                Solana Heist Console
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Bankroll Mafia
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Devnet</Badge>
            <Badge variant="secondary">Native SOL</Badge>
            <WalletConnectButton />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Choose The Job</CardTitle>
                    <CardDescription>
                      Pick a bankroll tier, target profile, and crew volatility
                      before signing the payment.
                    </CardDescription>
                  </div>
                  <Badge variant="warning">RTP capped below 100%</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={selectedTierId}
                  onValueChange={(value) => {
                    setSelectedTierId(value as HeistTier);
                  }}
                >
                  <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                    {tierConfigs.map((tier) => (
                      <TabsTrigger
                        key={tier.id}
                        value={tier.id}
                      >
                        {tier.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {tierConfigs.map((tier) => (
                    <TabsContent
                      key={tier.id}
                      value={tier.id}
                    >
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
                        <Metric
                          label="Vault Pool"
                          value={vaultDisplayByTier[tier.id]}
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Target</CardTitle>
                  <CardDescription>
                    Targets change risk shape; backend math remains
                    authoritative.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={selectedTargetId}
                    onValueChange={setSelectedTargetId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corner-bank">Corner Bank</SelectItem>
                      <SelectItem value="credit-union">Credit Union</SelectItem>
                      <SelectItem value="private-vault">
                        Private Vault
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="rounded-lg border border-border bg-secondary/50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Crosshair className="h-4 w-4 text-primary" />
                      Corner Bank
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Low bankroll target with stable volume and capped jackpot
                      exposure. Best for testing repeatable heist flow.
                    </p>
                  </div>
                </CardContent>
              </Card>

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
                            toggleCrewId(crew.id);
                          }}
                          disabled={!selected && selectedCrewIds.length >= 4}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-primary">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="font-semibold">{crew.label}</p>
                              {selected ? (
                                <Badge variant="success">Picked</Badge>
                              ) : null}
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
            </div>
          </section>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Heist Slip</CardTitle>
                <CardDescription>
                  The API will prepare the Solana transaction. The wallet signs
                  the final wager.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Metric
                    label="Entry"
                    value={formatSol(selectedTier.maxCostBaseUnits)}
                  />
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
                  No predeposit. Each heist is paid by wallet transfer and
                  settled by the trusted game treasury.
                </p>
              </CardContent>
            </Card>

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
                        variant={
                          outcome.id === "vault_jackpot" ? "default" : "outline"
                        }
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
                      {basisPointsToPercent(
                        selectedTier.dailyVaultPercentBasisPoints,
                      )}{" "}
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
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function formatSol(baseUnits: bigint) {
  const whole = baseUnits / SOL;
  const fractional = baseUnits % SOL;

  if (fractional === 0n) {
    return `${whole.toLocaleString("en-US")} SOL`;
  }

  const fraction = fractional.toString().padStart(9, "0").replace(/0+$/, "");

  return `${whole.toLocaleString("en-US")}.${fraction} SOL`;
}

function basisPointsToPercent(basisPoints: number) {
  const percent = basisPoints / 100;

  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}
