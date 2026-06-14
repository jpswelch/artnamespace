import { describe, expect, it } from "vitest";
import { namehash } from "viem";
import { normalize } from "viem/ens";
import { encodeSetTextCalls, ensTextRecordEntries } from "./ens";

describe("ENS text record helpers", () => {
  it("keeps zero string values and skips empty records", () => {
    expect(
      ensTextRecordEntries({
        "artnamespace.codeURI": "walrus://blob",
        "artnamespace.mintPriceWei": "0",
        empty: "",
        missing: undefined,
      }),
    ).toEqual([
      ["artnamespace.codeURI", "walrus://blob"],
      ["artnamespace.mintPriceWei", "0"],
    ]);
  });

  it("encodes setText calls for resolver multicall", () => {
    const node = namehash(normalize("curvefields.artnamespace-demo.eth"));
    const calls = encodeSetTextCalls(node, [["artnamespace.codeURI", "walrus://blob"]]);

    expect(calls).toHaveLength(1);
    expect(calls[0].startsWith("0x10f13a8c")).toBe(true);
  });
});
