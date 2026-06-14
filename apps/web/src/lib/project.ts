import { isAddress, zeroAddress } from "viem";
import type { CollectionRecord } from "./art/types";
import { ENS_TEXT_KEYS } from "./constants";

export function collectionSymbol(name: string, slug: string) {
  const candidate = (slug || name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return candidate || "ART";
}

export function resolveProjectContract(
  records: Record<string, string | undefined>,
  local?: CollectionRecord | null,
): `0x${string}` | undefined {
  const candidate =
    records[ENS_TEXT_KEYS.projectContract] ||
    records[ENS_TEXT_KEYS.contract] ||
    local?.contract;

  if (candidate && isAddress(candidate) && candidate !== zeroAddress) {
    return candidate;
  }

  return undefined;
}
