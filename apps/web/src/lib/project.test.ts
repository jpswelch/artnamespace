import { describe, expect, it } from "vitest";
import { ENS_TEXT_KEYS } from "./constants";
import { collectionSymbol, resolveProjectContract } from "./project";

describe("project helpers", () => {
  it("creates compact collection symbols", () => {
    expect(collectionSymbol("Curvefields", "curvefields")).toBe("CURVEFIELD");
    expect(collectionSymbol("!!!", "")).toBe("ART");
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
