"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { Banknote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  confirmHeistPayment,
  createHeistIntent,
  settleHeist,
} from "@/lib/api/heists";
import { useHeistUiStore } from "@/stores/heist-ui-store";

export function PrepareHeistButton() {
  const [pending, setPending] = useState(false);
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const selectedTierId = useHeistUiStore((state) => state.selectedTierId);
  const selectedTargetId = useHeistUiStore((state) => state.selectedTargetId);
  const selectedCrewIds = useHeistUiStore((state) => state.selectedCrewIds);
  const selectedHeistCostBaseUnits = useHeistUiStore(
    (state) => state.selectedHeistCostBaseUnits,
  );

  const handlePrepare = async () => {
    if (!publicKey) {
      toast.error("Connect wallet before preparing a heist");
      return;
    }

    if (selectedCrewIds.length !== 4) {
      toast.error("Pick exactly four crew members");
      return;
    }

    setPending(true);

    try {
      const intent = await createHeistIntent({
        tier: selectedTierId,
        targetId: selectedTargetId,
        crewIds: selectedCrewIds,
        heistCostBaseUnits: selectedHeistCostBaseUnits,
        idempotencyKey: crypto.randomUUID(),
      });

      if (!intent.transactionPreparation.available) {
        toast.error("Heist entry is not wired yet", {
          description:
            intent.transactionPreparation.reason ??
            "The onchain enter_heist flow still needs to replace the deprecated payment prototype.",
        });
        return;
      }

      if (!intent.transactionPreparation.transactionBase64) {
        throw new Error("API did not return a payment transaction");
      }

      const transaction = Transaction.from(
        decodeBase64(intent.transactionPreparation.transactionBase64),
      );
      const signature = await sendTransaction(transaction, connection);
      await confirmHeistPayment({
        heistId: intent.id,
        signature,
      });
      const settled = await settleHeist(intent.id);

      toast.success("Heist settled", {
        description: `${settled.outcome ?? "Outcome"} payout ${
          settled.payoutBaseUnits ?? "0"
        } lamports`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Connect wallet and sign in before preparing a heist.";

      toast.error("Could not prepare heist", {
        description: getActionableError(message),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      className="h-12 w-full"
      onClick={() => {
        void handlePrepare();
      }}
      disabled={pending || selectedCrewIds.length !== 4}
    >
      <Banknote className="h-5 w-5" aria-hidden="true" />
      {pending ? "Preparing..." : "Prepare Heist"}
    </Button>
  );
}

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function getActionableError(message: string) {
  if (message === "Authentication required") {
    return "Connect your wallet, then click Sign In before preparing a heist.";
  }

  return message;
}
