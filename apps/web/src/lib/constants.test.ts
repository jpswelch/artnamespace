import { describe, expect, it } from "vitest";
import { parseArtworkEns } from "./constants";

describe("ENS constants helpers", () => {
  it("parses numbered artwork ENS names", () => {
    expect(parseArtworkEns("004.curvefields.artist.eth")).toEqual({
      tokenId: 4,
      collectionENS: "curvefields.artist.eth",
    });
  });

  it("rejects malformed artwork ENS names", () => {
    expect(parseArtworkEns("curvefields.artist.eth")).toBeNull();
    expect(parseArtworkEns("000.curvefields.artist.eth")).toBeNull();
    expect(parseArtworkEns("004")).toBeNull();
  });
});
