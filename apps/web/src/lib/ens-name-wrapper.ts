import type { PublicClient, WalletClient } from "viem";
import { sepolia } from "viem/chains";

export const SEPOLIA_NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8" as const;

export const ensNameWrapperAbi = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export function isSepoliaNameWrapper(address?: string | null) {
  return Boolean(address && address.toLowerCase() === SEPOLIA_NAME_WRAPPER.toLowerCase());
}

export async function ensureNameWrapperApproval(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: `0x${string}`;
  operator: `0x${string}`;
}) {
  const alreadyApproved = await input.publicClient.readContract({
    address: SEPOLIA_NAME_WRAPPER,
    abi: ensNameWrapperAbi,
    functionName: "isApprovedForAll",
    args: [input.account, input.operator],
  });

  if (alreadyApproved) {
    return;
  }

  const tx = await input.walletClient.writeContract({
    account: input.account,
    chain: sepolia,
    address: SEPOLIA_NAME_WRAPPER,
    abi: ensNameWrapperAbi,
    functionName: "setApprovalForAll",
    args: [input.operator, true],
  });
  const receipt = await input.publicClient.waitForTransactionReceipt({ hash: tx });

  if (receipt.status !== "success") {
    throw new Error("The ENS Name Wrapper approval transaction reverted.");
  }
}
