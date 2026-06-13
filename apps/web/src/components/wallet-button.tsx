"use client";

import { Wallet, Unplug } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useEnsName, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { shortAddress } from "@/lib/format";

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: ensName } = useEnsName({ address, chainId: sepolia.id });

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
      <button className="inline-flex items-center gap-2 border border-line px-3 py-2 text-sm hover:border-ink" onClick={() => disconnect()}>
        <Unplug size={16} />
        {ensName || shortAddress(address)}
      </button>
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
