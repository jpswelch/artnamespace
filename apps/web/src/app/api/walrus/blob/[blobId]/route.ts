import { NextRequest } from "next/server";

export const runtime = "nodejs";

declare global {
  var __artnamespaceWalrusMock:
    | Map<string, { body: Uint8Array; contentType: string }>
    | undefined;
}

type RouteContext = {
  params: Promise<{ blobId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { blobId } = await context.params;
  const id = decodeURIComponent(blobId);

  const mock = globalThis.__artnamespaceWalrusMock?.get(id);
  if (mock) {
    const body = new ArrayBuffer(mock.body.byteLength);
    new Uint8Array(body).set(mock.body);
    return new Response(body, {
      headers: {
        "content-type": mock.contentType,
        "cache-control": "no-store",
      },
    });
  }

  const aggregator = process.env.WALRUS_AGGREGATOR_URL;
  if (!aggregator) {
    return new Response("WALRUS_AGGREGATOR_URL is required", { status: 500 });
  }

  const url = `${aggregator.replace(/\/$/, "")}/v1/blobs/${id}`;
  let lastStatus = 500;
  let lastText = "";

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { cache: "no-store" });
    if (response.ok) {
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      return new Response(response.body, {
        headers: {
          "content-type": contentType,
          "cache-control": "no-store",
        },
      });
    }

    lastStatus = response.status;
    lastText = await response.text();

    if (response.status !== 404) break;
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }

  return new Response(lastText || "Walrus blob unavailable", { status: lastStatus });
}
