import { describe, expect, it } from "vitest";
import { ENS_TEXT_KEYS } from "./constants";
import { collectionSymbol, latestMintedTokenIds, resolveProjectContract } from "./project";

describe("project helpers", () => {
  it("creates compact collection symbols", () => {
    expect(collectionSymbol("Curvefields", "curvefields")).toBe("CURVEFIELD");
    expect(collectionSymbol("!!!", "")).toBe("ART");
  });

  it("reads every minted token that could fit in the latest works slots", () => {
    expect(latestMintedTokenIds(5, 8)).toEqual([4, 3, 2, 1]);
    expect(latestMintedTokenIds(20, 8)).toEqual([19, 18, 17, 16, 15, 14, 13, 12]);
  });

  it("resolves project contract from preferred ENS record", () => {
    expect(
      resolveProjectContract({
        [ENS_TEXT_KEYS.projectContract]: "0x00000000000000000000000000000000000000aa",
        [ENS_TEXT_KEYS.contract]: "0x00000000000000000000000000000000000000bb",
      }),
    ).toBe("0x00000000000000000000000000000000000000aa");
  });

  it("falls back to compatibility contract record", () => {
    expect(
      resolveProjectContract({
        [ENS_TEXT_KEYS.contract]: "0x00000000000000000000000000000000000000bb",
      }),
    ).toBe("0x00000000000000000000000000000000000000bb");
  });

  it("ignores zero or invalid contract values", () => {
    expect(
      resolveProjectContract({
        [ENS_TEXT_KEYS.projectContract]: "0x0000000000000000000000000000000000000000",
      }),
    ).toBeUndefined();
    expect(resolveProjectContract({ [ENS_TEXT_KEYS.projectContract]: "not-an-address" })).toBeUndefined();
  });
});
