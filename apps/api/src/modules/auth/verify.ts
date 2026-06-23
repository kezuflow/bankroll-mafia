import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export function assertValidSolanaAddress(walletAddress: string) {
  try {
    return new PublicKey(walletAddress).toBase58();
  } catch {
    throw new Error("Invalid Solana wallet address");
  }
}

export function verifySolanaMessageSignature({
  walletAddress,
  message,
  signature,
}: {
  walletAddress: string;
  message: string;
  signature: string;
}) {
  const publicKey = new PublicKey(walletAddress);
  const messageBytes = new TextEncoder().encode(message);

  let signatureBytes: Uint8Array;

  try {
    signatureBytes = bs58.decode(signature);
  } catch {
    return false;
  }

  return nacl.sign.detached.verify(
    messageBytes,
    signatureBytes,
    publicKey.toBytes(),
  );
}
