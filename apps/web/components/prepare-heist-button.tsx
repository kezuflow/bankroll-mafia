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
        toast.error("Heist unavailable", {
          description:
            intent.transactionPreparation.reason ??
            "The selected tier cannot safely accept this heist right now.",
        });
        return;
      }

      if (!intent.transactionPreparation.transactionBase64) {
        throw new Error("API did not return a payment transaction");
      }

      const requiredLamports = BigInt(
        intent.transactionPreparation.amountBaseUnits ??
          selectedHeistCostBaseUnits,
      );
      const balanceLamports = BigInt(await connection.getBalance(publicKey));

      if (balanceLamports < requiredLamports) {
        throw new Error(
          `Connected wallet has ${formatLamports(
            balanceLamports,
          )} on ${getConfiguredCluster()} but this heist needs ${formatLamports(
            requiredLamports,
          )}. Airdrop devnet SOL to this wallet or switch Phantom to devnet.`,
        );
      }

      const transaction = Transaction.from(
        decodeBase64(intent.transactionPreparation.transactionBase64),
      );
      const signature = await sendTransaction(transaction, connection);

      await waitForConfirmedPayment({
        connection,
        signature,
        latestBlockhash: intent.transactionPreparation.latestBlockhash,
        lastValidBlockHeight:
          intent.transactionPreparation.lastValidBlockHeight,
      });

      await confirmHeistPayment({
        heistId: intent.id,
        signature,
      });
      const settled = await settleHeist(intent.id);

      toast.success("Heist settled", {
        description: `${settled.outcome ?? "Outcome"} payout ${formatLamports(
          BigInt(settled.payoutBaseUnits ?? "0"),
        )}`,
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

function getConfiguredCluster() {
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
}

function formatLamports(lamports: bigint) {
  const sol = 1_000_000_000n;
  const whole = lamports / sol;
  const fractional = lamports % sol;

  if (fractional === 0n) {
    return `${whole.toLocaleString("en-US")} SOL`;
  }

  const fraction = fractional.toString().padStart(9, "0").replace(/0+$/, "");

  return `${whole.toLocaleString("en-US")}.${fraction} SOL`;
}

async function waitForConfirmedPayment({
  connection,
  signature,
  latestBlockhash,
  lastValidBlockHeight,
}: {
  connection: ReturnType<typeof useConnection>["connection"];
  signature: string;
  latestBlockhash?: string;
  lastValidBlockHeight?: number;
}) {
  if (latestBlockhash && lastValidBlockHeight && lastValidBlockHeight > 0) {
    const result = await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash,
        lastValidBlockHeight,
      },
      "confirmed",
    );

    if (result.value.err) {
      throw new Error("Payment transaction failed onchain");
    }

    return;
  }

  const result = await connection.confirmTransaction(signature, "confirmed");

  if (result.value.err) {
    throw new Error("Payment transaction failed onchain");
  }
}

function getActionableError(message: string) {
  if (message === "Authentication required") {
    return "Connect your wallet, then click Sign In before preparing a heist.";
  }

  if (
    message.includes("InsufficientVaultFunds") ||
    message.includes("custom program error: 0x1777") ||
    message.includes("Insufficient vault funds")
  ) {
    return "The tier vault does not have enough available SOL to pay this outcome. Seed the onchain vault or use a smaller heist size.";
  }

  return message;
}
