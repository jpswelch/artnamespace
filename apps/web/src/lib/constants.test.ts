import { afterEach, describe, expect, it, vi } from "vitest";
import { getArtistEnsRoot, getFactoryAddress, getMainnetRpcUrl, parseArtworkEns } from "./constants";

describe("ENS constants helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("normalizes env address values before contract reads", () => {
    vi.stubEnv("NEXT_PUBLIC_ARTNAMESPACE_FACTORY", " 0x85f6235652fb9A5113D07B4C6497Ec0848E27938 \n");

    expect(getFactoryAddress()).toBe("0x85f6235652fb9A5113D07B4C6497Ec0848E27938");
  });

  it("ignores invalid env address values", () => {
    vi.stubEnv("NEXT_PUBLIC_ARTNAMESPACE_FACTORY", "0x85f6235652fb9A5113D07B4C6497Ec0848E27938 nope");

    expect(getFactoryAddress()).toBeUndefined();
  });

  it("trims string env values", () => {
    vi.stubEnv("NEXT_PUBLIC_ARTIST_ENS_ROOT", " johannes.eth ");
    vi.stubEnv("NEXT_PUBLIC_MAINNET_RPC_URL", " https://example.invalid/rpc ");

    expect(getArtistEnsRoot()).toBe("johannes.eth");
    expect(getMainnetRpcUrl()).toBe("https://example.invalid/rpc");
  });
});
