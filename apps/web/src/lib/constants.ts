export const SEPOLIA_CHAIN_ID = 11155111;

export const ENS_TEXT_KEYS = {
  creator: "artnamespace.creator",
  collection: "artnamespace.collection",
  algorithmHash: "artnamespace.algorithmHash",
  codeURI: "artnamespace.codeURI",
  tokenId: "artnamespace.tokenId",
  seed: "artnamespace.seed",
  paramsHash: "artnamespace.paramsHash",
  metadataURI: "artnamespace.metadataURI",
  renderURI: "artnamespace.renderURI",
  contract: "artnamespace.contract",
  factory: "artnamespace.factory",
  projectContract: "artnamespace.projectContract",
  mintPriceWei: "artnamespace.mintPriceWei",
  maxSupply: "artnamespace.maxSupply",
  manifestURI: "artnamespace.manifestURI",
  chain: "artnamespace.chain",
  subnameRegistrar: "artnamespace.subnameRegistrar",
  subnameParentNode: "artnamespace.subnameParentNode",
  artworkResolver: "artnamespace.artworkResolver",
} as const;

export const DEFAULT_COLLECTION_SLUG = "curvefields";
export const DEFAULT_COLLECTION_NAME = "Curvefields";

export function getArtistEnsRoot() {
  return process.env.NEXT_PUBLIC_ARTIST_ENS_ROOT || "artnamespace-demo.eth";
}

export function getCollectionEns(artistRoot = getArtistEnsRoot(), collectionSlug = DEFAULT_COLLECTION_SLUG) {
  return `${collectionSlug}.${artistRoot}`;
}

export function getArtworkEns(tokenId: number, collectionEns = getCollectionEns()) {
  return `${tokenId.toString().padStart(3, "0")}.${collectionEns}`;
}

export function parseArtworkEns(artworkENS: string) {
  const [label, ...collectionParts] = artworkENS.split(".");
  const collectionENS = collectionParts.join(".");
  if (!label || !collectionENS || !/^\d+$/.test(label)) return null;

  const tokenId = Number(label);
  if (!Number.isSafeInteger(tokenId) || tokenId < 1) return null;

  return { tokenId, collectionENS };
}

export function getDropContractAddress() {
  return process.env.NEXT_PUBLIC_DROP_CONTRACT as `0x${string}` | undefined;
}

export function getFactoryAddress() {
  return process.env.NEXT_PUBLIC_ARTNAMESPACE_FACTORY as `0x${string}` | undefined;
}

export function getSepoliaRpcUrl() {
  return (
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com"
  );
}

export function getMainnetRpcUrl() {
  return process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";
}
