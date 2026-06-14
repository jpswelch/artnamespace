import { formatEther, parseEther } from "viem";

export function formatMintPrice(mintPriceWei: bigint | string | number | undefined) {
  const value = BigInt(mintPriceWei || 0);
  if (value === 0n) return "Free mint";
  return `${formatEther(value)} ETH`;
}

export function parseMintPriceEth(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  return parseEther(trimmed);
}
