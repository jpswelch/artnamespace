import { parseEther } from "viem";
import { describe, expect, it } from "vitest";
import { formatMintPrice, parseMintPriceEth } from "./price";

describe("mint price helpers", () => {
  it("formats zero as free", () => {
    expect(formatMintPrice(0n)).toBe("Free mint");
    expect(formatMintPrice("0")).toBe("Free mint");
  });

  it("formats non-zero wei as ETH", () => {
    expect(formatMintPrice(parseEther("0.05"))).toBe("0.05 ETH");
  });

  it("parses blank and explicit ETH values", () => {
    expect(parseMintPriceEth("")).toBe(0n);
    expect(parseMintPriceEth("0.05")).toBe(parseEther("0.05"));
  });
});
