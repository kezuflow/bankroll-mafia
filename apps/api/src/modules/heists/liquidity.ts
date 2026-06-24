import { SOL, tierConfigs, type TierConfig } from "@bankroll/game-config";
import { calculateVaultPayout, multiplyBasisPoints } from "@bankroll/economy";
import { deriveTierVaultPda } from "@bankroll/solana";
import type { HeistTier } from "@bankroll/shared-types";
import { Connection, PublicKey } from "@solana/web3.js";

const tierVaultAccountSpace = 34;
const fullSuccessMultiplierBasisPoints = 12_000;

export async function getTierVaultLiquidity({
  connection,
  programId,
  tier,
}: {
  connection: Connection;
  programId: PublicKey;
  tier: HeistTier;
}) {
  const address = deriveTierVaultPda({
    programId,
    tier,
  }).address;
  const [account, rentFloorLamports] = await Promise.all([
    connection.getAccountInfo(address, "confirmed"),
    connection.getMinimumBalanceForRentExemption(tierVaultAccountSpace),
  ]);

  if (!account) {
    throw new Error(`${getTierLabel(tier)} vault is not initialized onchain`);
  }

  const lamports = BigInt(account.lamports);
  const rentFloorBaseUnits = BigInt(rentFloorLamports);

  return {
    address,
    lamports,
    rentFloorBaseUnits,
    availableBaseUnits:
      lamports > rentFloorBaseUnits ? lamports - rentFloorBaseUnits : 0n,
  };
}

export function calculateMaxHeistPayout({
  heistCostBaseUnits,
  tierConfig,
  projectedVaultAvailableBaseUnits,
}: {
  heistCostBaseUnits: bigint;
  tierConfig: TierConfig;
  projectedVaultAvailableBaseUnits: bigint;
}) {
  const vaultJackpotPayout = calculateVaultPayout({
    tierVaultPoolBaseUnits: projectedVaultAvailableBaseUnits,
    heistCostBaseUnits,
    vaultPercentBasisPoints: 100,
    maxMultiplierBasisPoints: tierConfig.vaultMaxMultiplierBasisPoints,
    remainingDailyPayoutCapBaseUnits: tierConfig.absoluteDailyVaultCapBaseUnits,
  });
  const fullSuccessPayout = multiplyBasisPoints(
    heistCostBaseUnits,
    fullSuccessMultiplierBasisPoints,
  );

  return vaultJackpotPayout > fullSuccessPayout
    ? vaultJackpotPayout
    : fullSuccessPayout;
}

export function getTierConfig(tier: HeistTier) {
  const tierConfig = tierConfigs.find((config) => config.id === tier);

  if (!tierConfig) {
    throw new Error("Tier config not found");
  }

  return tierConfig;
}

export function getTierLabel(tier: HeistTier) {
  return getTierConfig(tier).label;
}

export function formatSolAmount(baseUnits: bigint) {
  const whole = baseUnits / SOL;
  const fractional = baseUnits % SOL;

  if (fractional === 0n) {
    return `${whole.toLocaleString("en-US")} SOL`;
  }

  const fraction = fractional.toString().padStart(9, "0").replace(/0+$/, "");

  return `${whole.toLocaleString("en-US")}.${fraction} SOL`;
}
