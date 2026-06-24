import { PublicKey } from "@solana/web3.js";

import { heistAccountDiscriminator } from "./constants.js";
import { assertBytesEqual, readU64Le } from "./bytes.js";

export interface DecodedHeistAccount {
  player: PublicKey;
  tier: number;
  idempotencySeed: Uint8Array;
  targetIdSeed: Uint8Array;
  crewIds: Uint8Array;
  heistCostLamports: bigint;
  status: number;
  outcome: number;
  payoutLamports: bigint;
  bump: number;
}

export function decodeHeistAccount(data: Uint8Array): DecodedHeistAccount {
  if (data.length < 112) {
    throw new Error("Heist account data is too short");
  }

  assertBytesEqual(data.slice(0, 8), heistAccountDiscriminator);

  return {
    player: new PublicKey(data.slice(8, 40)),
    tier: data[40]!,
    idempotencySeed: data.slice(41, 57),
    targetIdSeed: data.slice(57, 89),
    crewIds: data.slice(89, 93),
    heistCostLamports: readU64Le(data.slice(93, 101)),
    status: data[101]!,
    outcome: data[102]!,
    payoutLamports: readU64Le(data.slice(103, 111)),
    bump: data[111]!,
  };
}
