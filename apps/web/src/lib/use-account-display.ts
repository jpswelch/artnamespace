"use client";

import { shortAddress } from "./format";
import { useSepoliaEnsName } from "./use-sepolia-ens-name";

export function useAccountDisplay(address?: `0x${string}`) {
  const { ensName, isLoading } = useSepoliaEnsName(address);

  return {
    ensName,
    displayName: ensName || (address ? shortAddress(address) : "Profile"),
    isLoading,
  };
}
