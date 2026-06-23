import { apiFetch } from "./client";

export interface AuthMe {
  authenticated: boolean;
  walletAddress?: string;
  expiresAt?: string;
}

export interface AuthNonce {
  walletAddress: string;
  domain: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export function getAuthMe() {
  return apiFetch<AuthMe>("/auth/me");
}

export function createAuthNonce(walletAddress: string) {
  return apiFetch<AuthNonce>("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({
      walletAddress,
    }),
  });
}

export function verifyAuthSignature(input: {
  walletAddress: string;
  domain: string;
  nonce: string;
  signature: string;
}) {
  return apiFetch<{ walletAddress: string; expiresAt: string }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return apiFetch<{ ok: true }>("/auth/logout", {
    method: "POST",
  });
}
