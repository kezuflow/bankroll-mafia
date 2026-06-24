"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createAuthNonce,
  getAuthMe,
  logout,
  verifyAuthSignature,
} from "@/lib/api/auth";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);
  const { publicKey, connected, signMessage } = useWallet();
  const { data, error, isLoading, mutate } = useSWR("/auth/me", getAuthMe, {
    shouldRetryOnError: false,
  });
  const authenticated =
    data?.authenticated && publicKey?.toBase58() === data.walletAddress;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Wallet Offline</Badge>
        <Button type="button" disabled>
          Select Wallet
        </Button>
      </div>
    );
  }

  const handleSignIn = async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet does not support message signing");
    }

    const walletAddress = publicKey.toBase58();
    const nonce = await createAuthNonce(walletAddress);
    const signature = await signMessage(new TextEncoder().encode(nonce.message));

    await verifyAuthSignature({
      walletAddress,
      domain: nonce.domain,
      nonce: nonce.nonce,
      signature: bs58.encode(signature),
    });
    await mutate();
  };

  const handleLogout = async () => {
    await logout();
    await mutate();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {connected && publicKey ? (
        <Badge variant="success">{shortAddress(publicKey.toBase58())}</Badge>
      ) : (
        <Badge variant="outline">Wallet Offline</Badge>
      )}
      {authenticated ? <Badge variant="success">API Signed In</Badge> : null}
      {error && connected ? <Badge variant="warning">API Offline</Badge> : null}
      <WalletMultiButton className="!h-10 !rounded-md !bg-primary !px-4 !py-2 !text-sm !font-semibold !text-primary-foreground hover:!bg-primary/90" />
      {connected && !authenticated ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void handleSignIn();
          }}
          disabled={!signMessage || isLoading}
        >
          Sign In
        </Button>
      ) : null}
      {authenticated ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void handleLogout();
          }}
        >
          Logout
        </Button>
      ) : null}
    </div>
  );
}
