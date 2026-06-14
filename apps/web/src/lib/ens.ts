import { createPublicClient, createWalletClient, custom, encodeFunctionData, http, namehash, type PublicClient, type WalletClient } from "viem";
import { normalize } from "viem/ens";
import { sepolia } from "viem/chains";
import { getSepoliaRpcUrl } from "./constants";

export const publicResolverAbi = [
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

export function createEnsPublicClient(): PublicClient {
  return createPublicClient({
    chain: sepolia,
    transport: http(getSepoliaRpcUrl()),
  });
}

export function browserWalletClient(account: `0x${string}`): WalletClient {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found");
  }

  return createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum as Parameters<typeof custom>[0]),
    account,
  });
}

export async function readEnsTextRecords(input: {
  client?: PublicClient;
  name: string;
  keys: string[];
}): Promise<Record<string, string>> {
  const client = input.client || createEnsPublicClient();
  const records: Record<string, string> = {};

  await Promise.all(
    input.keys.map(async (key) => {
      try {
        const value = await client.getEnsText({
          name: normalize(input.name),
          key,
        });
        if (value) records[key] = value;
      } catch {
        records[key] = "";
      }
    }),
  );

  return records;
}

export async function getResolverForName(client: PublicClient, name: string) {
  return client.getEnsResolver({ name: normalize(name) });
}

export function ensTextRecordEntries(records: Record<string, string | undefined>) {
  return Object.entries(records).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);
}

export function encodeSetTextCalls(node: `0x${string}`, entries: [string, string][]) {
  return entries.map(([key, value]) =>
    encodeFunctionData({
      abi: publicResolverAbi,
      functionName: "setText",
      args: [node, key, value],
    }),
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const details = "details" in error && typeof error.details === "string" ? ` ${error.details}` : "";
    return `${error.message}${details}`;
  }

  return String(error);
}

function shouldFallbackToSequentialWrites(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("multicall") &&
    (message.includes("unsupported") ||
      message.includes("function selector") ||
      message.includes("function does not exist") ||
      message.includes("method not found"))
  );
}

export async function writeEnsTextRecords(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: `0x${string}`;
  name: string;
  records: Record<string, string | undefined>;
}) {
  const resolver = await getResolverForName(input.publicClient, input.name);

  if (!resolver) {
    throw new Error(`No resolver configured for ${input.name}`);
  }

  const node = namehash(normalize(input.name));
  const entries = ensTextRecordEntries(input.records);
  const txs: `0x${string}`[] = [];

  if (entries.length === 0) {
    return txs;
  }

  if (entries.length > 1) {
    try {
      const hash = await input.walletClient.writeContract({
        account: input.account,
        chain: sepolia,
        address: resolver,
        abi: publicResolverAbi,
        functionName: "multicall",
        args: [encodeSetTextCalls(node, entries)],
      });
      await input.publicClient.waitForTransactionReceipt({ hash });
      return [hash];
    } catch (error) {
      if (!shouldFallbackToSequentialWrites(error)) {
        throw error;
      }
    }
  }

  for (const [key, value] of entries) {
    const hash = await input.walletClient.writeContract({
      account: input.account,
      chain: sepolia,
      address: resolver,
      abi: publicResolverAbi,
      functionName: "setText",
      args: [node, key, value],
    });
    txs.push(hash);
    await input.publicClient.waitForTransactionReceipt({ hash });
  }

  return txs;
}

declare global {
  interface Window {
    ethereum?: unknown;
  }
}
