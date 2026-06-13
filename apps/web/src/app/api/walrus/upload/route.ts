import { NextRequest } from "next/server";
import { extractWalrusBlobId, walrusUri } from "@/lib/walrus";

export const runtime = "nodejs";

type UploadBody = {
  filename: string;
  contentType: string;
  content: string;
  encoding?: "utf8" | "base64";
};

type MockStore = Map<string, { body: Uint8Array; contentType: string }>;

declare global {
  var __artnamespaceWalrusMock: MockStore | undefined;
}

export async function POST(request: NextRequest) {
  const input = (await request.json()) as UploadBody;

  if (!input.content || !input.filename || !input.contentType) {
    return new Response("filename, contentType, and content are required", { status: 400 });
  }

  const body =
    input.encoding === "base64"
      ? Buffer.from(input.content, "base64")
      : Buffer.from(input.content, "utf8");

  if (process.env.WALRUS_MOCK === "true") {
    const { keccak256, toHex } = await import("viem");
    const blobId = keccak256(toHex(body)).slice(2);
    globalThis.__artnamespaceWalrusMock ||= new Map();
    globalThis.__artnamespaceWalrusMock.set(blobId, {
      body,
      contentType: input.contentType,
    });

    return Response.json({
      blobId,
      uri: walrusUri(blobId),
      aggregatorUrl: `/api/walrus/blob/${blobId}`,
      raw: { mock: true, filename: input.filename },
    });
  }

  const publisher = process.env.WALRUS_PUBLISHER_URL;
  const aggregator = process.env.WALRUS_AGGREGATOR_URL;

  if (!publisher || !aggregator) {
    return new Response("WALRUS_PUBLISHER_URL and WALRUS_AGGREGATOR_URL are required", { status: 500 });
  }

  const epochs = process.env.WALRUS_EPOCHS || "5";
  const response = await fetch(`${publisher.replace(/\/$/, "")}/v1/blobs?epochs=${encodeURIComponent(epochs)}`, {
    method: "PUT",
    headers: {
      "content-type": input.contentType,
    },
    body,
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  const raw = await response.json();
  const { blobId, objectId } = extractWalrusBlobId(raw);

  return Response.json({
    blobId,
    objectId,
    uri: walrusUri(blobId),
    aggregatorUrl: `${aggregator.replace(/\/$/, "")}/v1/blobs/${blobId}`,
    raw,
  });
}
