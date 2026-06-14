import { walrusProxyUrl } from "@/lib/walrus";

export type ArtworkMetadataAttribute = {
  trait_type?: string;
  value?: unknown;
};

export type ArtworkNftMetadata = {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: ArtworkMetadataAttribute[];
  properties?: {
    seed?: unknown;
    params?: unknown;
    algorithmHash?: unknown;
    [key: string]: unknown;
  };
};

export async function fetchArtworkMetadata(metadataURI: string) {
  try {
    const response = await fetch(walrusProxyUrl(metadataURI));
    if (!response.ok) return null;
    return (await response.json()) as ArtworkNftMetadata;
  } catch {
    return null;
  }
}

export function metadataFeatures(metadata: ArtworkNftMetadata | null | undefined) {
  const features: Record<string, string> = {};
  for (const attribute of metadata?.attributes || []) {
    if (!attribute.trait_type || typeof attribute.value === "undefined") continue;
    features[attribute.trait_type] = String(attribute.value);
  }
  return features;
}
