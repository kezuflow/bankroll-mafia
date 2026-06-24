import { Vault } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export function HeistConsoleHeader() {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Vault className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">
            Solana Heist Console
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">Bankroll Mafia</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{cluster}</Badge>
        <Badge variant="secondary">Native SOL</Badge>
        <WalletConnectButton />
      </div>
    </header>
  );
}
