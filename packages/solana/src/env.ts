import { PublicKey } from "@solana/web3.js";

import { BANKROLL_PROGRAM_ID_ENV } from "./constants.js";

export function getRequiredProgramIdFromEnv(
  env: Record<string, string | undefined>,
) {
  const value = env[BANKROLL_PROGRAM_ID_ENV];

  if (!value) {
    throw new Error(`${BANKROLL_PROGRAM_ID_ENV} is required`);
  }

  return new PublicKey(value);
}
