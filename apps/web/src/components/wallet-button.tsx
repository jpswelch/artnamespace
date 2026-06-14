"use client";

import Link from "next/link";
import { UserCircle, Wallet, Unplug } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useAccountDisplay } from "@/lib/use-account-display";

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { displayName } = useAccountDisplay(address);

  if (isConnected && chainId !== sepolia.id) {
    return (
      <button className="inline-flex items-center gap-2 border border-amber-700 px-3 py-2 text-sm text-amber-800" onClick={() => switchChain({ chainId: sepolia.id })}>
        <Wallet size={16} />
        {switching ? "Switching..." : "Switch to Sepolia"}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <Link className="inline-flex items-center gap-2 border border-line px-3 py-2 text-sm hover:border-ink" href="/profile">
          <UserCircle size={16} />
          {displayName}
        </Link>
        <button aria-label="Disconnect wallet" className="inline-flex size-9 items-center justify-center border border-line hover:border-ink" onClick={() => disconnect()}>
          <Unplug size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      className="inline-flex items-center gap-2 bg-ink px-3 py-2 text-sm text-white hover:bg-black"
      disabled={isPending}
      onClick={() => connect({ connector: connectors[0] })}
    >
      <Wallet size={16} />
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
