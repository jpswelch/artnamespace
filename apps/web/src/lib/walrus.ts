import type { WalrusUploadResult } from "./art/types";

const DEFAULT_WALRUS_AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

export function walrusUri(blobId: string) {
  return `walrus://${blobId}`;
}

export function isWalrusUri(uri: string | undefined): uri is string {
  return Boolean(uri?.startsWith("walrus://"));
}

export function blobIdFromWalrusUri(uri: string) {
  return uri.startsWith("walrus://") ? uri.slice("walrus://".length) : uri;
}

export function walrusAggregatorUrl() {
  return (
    process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ||
    process.env.WALRUS_AGGREGATOR_URL ||
    DEFAULT_WALRUS_AGGREGATOR_URL
  ).replace(/\/$/, "");
}

export function walrusDirectUrl(uri: string) {
  return `${walrusAggregatorUrl()}/v1/blobs/${encodeURIComponent(blobIdFromWalrusUri(uri))}`;
}

export function walrusProxyUrl(uri: string) {
  const blobId = blobIdFromWalrusUri(uri);
  return `/api/walrus/blob/${encodeURIComponent(blobId)}`;
}

export async function uploadWalrusArtifact(input: {
  filename: string;
  contentType: string;
  content: string;
  encoding?: "utf8" | "base64";
}): Promise<WalrusUploadResult> {
  const response = await fetch("/api/walrus/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export function extractWalrusBlobId(response: unknown): { blobId: string; objectId?: string } {
  const payload = response as {
    newlyCreated?: { blobObject?: { id?: string; blobId?: string } };
    alreadyCertified?: { blobId?: string };
  };

  if (payload.newlyCreated?.blobObject?.blobId) {
    return {
      blobId: payload.newlyCreated.blobObject.blobId,
      objectId: payload.newlyCreated.blobObject.id,
    };
  }

  if (payload.alreadyCertified?.blobId) {
    return { blobId: payload.alreadyCertified.blobId };
  }

  throw new Error("Walrus publisher response did not include a blob id");
}
