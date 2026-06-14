import { describe, expect, it } from "vitest";
import { blobIdFromWalrusUri, extractWalrusBlobId, isWalrusUri, walrusDirectUrl, walrusUri } from "./walrus";

describe("walrus helpers", () => {
  it("normalizes walrus URIs", () => {
    expect(walrusUri("abc")).toBe("walrus://abc");
    expect(blobIdFromWalrusUri("walrus://abc")).toBe("abc");
    expect(blobIdFromWalrusUri("abc")).toBe("abc");
    expect(isWalrusUri("walrus://abc")).toBe(true);
    expect(isWalrusUri("https://example.com")).toBe(false);
  });

  it("builds direct aggregator URLs", () => {
    expect(walrusDirectUrl("walrus://abc")).toBe("https://aggregator.walrus-testnet.walrus.space/v1/blobs/abc");
  });

  it("extracts newly created blob IDs", () => {
    expect(
      extractWalrusBlobId({
        newlyCreated: {
          blobObject: {
            id: "0x1",
            blobId: "blob",
          },
        },
      }),
    ).toEqual({ blobId: "blob", objectId: "0x1" });
  });

  it("extracts already certified blob IDs", () => {
    expect(extractWalrusBlobId({ alreadyCertified: { blobId: "blob" } })).toEqual({ blobId: "blob" });
  });
});
