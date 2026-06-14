"use client";

import { useEnsName } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { shortAddress } from "./format";

export function useAccountDisplay(address?: `0x${string}`) {
  const enabled = Boolean(address);
  const { data: sepoliaName, isLoading: loadingSepolia } = useEnsName({
    address,
    chainId: sepolia.id,
    query: {
      enabled,
    },
  });
  const { data: mainnetName, isLoading: loadingMainnet } = useEnsName({
    address,
    chainId: mainnet.id,
    query: {
      enabled,
    },
  });

  const ensName = sepoliaName || mainnetName || undefined;

  return {
    ensName,
    displayName: ensName || (address ? shortAddress(address) : "Profile"),
    isLoading: loadingSepolia || loadingMainnet,
  };
}
