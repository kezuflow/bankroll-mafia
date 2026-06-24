import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  deriveHeistPda,
  deriveProgramConfigPda,
  deriveTierVaultPda,
  tierSeedBytes,
} from "./index.js";

describe("pda derivation", () => {
  it("derives stable tier vault PDAs by tier", () => {
    const programId = Keypair.generate().publicKey;
    const first = deriveTierVaultPda({ programId, tier: "street" });
    const second = deriveTierVaultPda({ programId, tier: "street" });
    const otherTier = deriveTierVaultPda({ programId, tier: "crew" });

    expect(first.address.toBase58()).toBe(second.address.toBase58());
    expect(first.bump).toBe(second.bump);
    expect(first.address.toBase58()).not.toBe(otherTier.address.toBase58());
  });

  it("uses the same tier vault seed bytes as the onchain program", () => {
    const programId = Keypair.generate().publicKey;
    const helper = deriveTierVaultPda({ programId, tier: "boss" });
    const [manual] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("vault"), new Uint8Array([tierSeedBytes.boss])],
      programId,
    );

    expect(helper.address.toBase58()).toBe(manual.toBase58());
  });

  it("derives stable heist PDAs from wallet and idempotency key", () => {
    const programId = Keypair.generate().publicKey;
    const wallet = Keypair.generate().publicKey;
    const first = deriveHeistPda({
      programId,
      walletAddress: wallet,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });
    const second = deriveHeistPda({
      programId,
      walletAddress: wallet,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });

    expect(first.address.toBase58()).toBe(second.address.toBase58());
  });

  it("derives a program config PDA", () => {
    const programId = Keypair.generate().publicKey;
    const config = deriveProgramConfigPda(programId);

    expect(config.address.toBase58()).not.toBe(programId.toBase58());
  });
});
