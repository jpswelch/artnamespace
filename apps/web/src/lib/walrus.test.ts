import { describe, expect, it } from "vitest";
import { blobIdFromWalrusUri, extractWalrusBlobId, walrusUri } from "./walrus";

describe("walrus helpers", () => {
  it("normalizes walrus URIs", () => {
    expect(walrusUri("abc")).toBe("walrus://abc");
    expect(blobIdFromWalrusUri("walrus://abc")).toBe("abc");
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
