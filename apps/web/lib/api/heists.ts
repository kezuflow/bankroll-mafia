import { apiFetch } from "./client";

export interface HeistIntentResponse {
  id: string;
  tier: string;
  targetId: string;
  crewIds: string[];
  heistCostBaseUnits: string;
  status: string;
  outcome?: string;
  payoutBaseUnits?: string;
  vaultPayoutBaseUnits?: string;
  settlementSignature?: string;
  settledAt?: string;
  transactionPreparation: {
    available: boolean;
    reason: string;
    transactionBase64?: string;
    recipientAddress?: string;
    asset?: "SOL";
    amountBaseUnits?: string;
  };
  reused: boolean;
  paymentSignature?: string;
}

export function createHeistIntent(input: {
  tier: string;
  targetId: string;
  crewIds: string[];
  heistCostBaseUnits: string;
  idempotencyKey: string;
}) {
  return apiFetch<HeistIntentResponse>("/heists/intent", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function confirmHeistPayment(input: {
  heistId: string;
  signature: string;
}) {
  return apiFetch<HeistIntentResponse>(`/heists/${input.heistId}/payment`, {
    method: "POST",
    body: JSON.stringify({
      signature: input.signature,
    }),
  });
}

export function settleHeist(heistId: string) {
  return apiFetch<HeistIntentResponse>(`/heists/${heistId}/settle`, {
    method: "POST",
  });
}
