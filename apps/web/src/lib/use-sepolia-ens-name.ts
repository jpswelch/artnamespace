"use client";

import { useEffect, useState } from "react";
import { getAddress, zeroAddress } from "viem";
import { namehash, normalize } from "viem/ens";
import { usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const ensRegistryAbi = [
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const reverseResolverAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

type ReverseResult = {
  address?: `0x${string}`;
  ensName?: string;
};

export function useSepoliaEnsName(address?: `0x${string}`) {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const [result, setResult] = useState<ReverseResult>({});
  const resolvedForAddress = result.address?.toLowerCase() === address?.toLowerCase();

  useEffect(() => {
    let cancelled = false;

    async function resolveName() {
      if (!address || !publicClient) return;
      await Promise.resolve();

      try {
        const normalizedAddress = getAddress(address);
        const reverseNode = namehash(`${normalizedAddress.slice(2).toLowerCase()}.addr.reverse`);
        const resolver = await publicClient.readContract({
          address: ENS_REGISTRY,
          abi: ensRegistryAbi,
          functionName: "resolver",
          args: [reverseNode],
        });

        if (resolver === zeroAddress) {
          if (!cancelled) setResult({ address: normalizedAddress });
          return;
        }

        const reverseName = await publicClient.readContract({
          address: resolver,
          abi: reverseResolverAbi,
          functionName: "name",
          args: [reverseNode],
        });

        const normalizedName = normalize(reverseName);
        const forwardAddress = await publicClient.getEnsAddress({ name: normalizedName });
        const ensName = forwardAddress && getAddress(forwardAddress) === normalizedAddress ? normalizedName : undefined;

        if (!cancelled) {
          setResult({ address: normalizedAddress, ensName });
        }
      } catch {
        if (!cancelled) {
          setResult({ address });
        }
      }
    }

    void resolveName();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  return {
    ensName: resolvedForAddress ? result.ensName : undefined,
    isLoading: Boolean(address && publicClient && !resolvedForAddress),
  };
}
