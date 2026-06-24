import { SOL } from "@bankroll/game-config";

export function formatSol(baseUnits: bigint) {
  const whole = baseUnits / SOL;
  const fractional = baseUnits % SOL;

  if (fractional === 0n) {
    return `${whole.toLocaleString("en-US")} SOL`;
  }

  const fraction = fractional.toString().padStart(9, "0").replace(/0+$/, "");

  return `${whole.toLocaleString("en-US")}.${fraction} SOL`;
}

export function basisPointsToPercent(basisPoints: number) {
  const percent = basisPoints / 100;

  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}
