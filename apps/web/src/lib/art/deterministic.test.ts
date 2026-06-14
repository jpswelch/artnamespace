import { describe, expect, it } from "vitest";
import { canonicalJson, createSeed, createUniquenessHash, generateParams, hashJson } from "./deterministic";
import { sampleParamsSchema } from "./sample";

describe("deterministic art helpers", () => {
  it("canonicalizes JSON by key order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });

  it("generates stable params from a seed", () => {
    const seed = createSeed("curvefields");
    expect(generateParams(sampleParamsSchema, seed)).toEqual(generateParams(sampleParamsSchema, seed));
  });

  it("hashes params and uniqueness deterministically", () => {
    const paramsHash = hashJson({ density: 100, loop: false });
    const uniqueness = createUniquenessHash({
      artistENS: "artnamespace-demo.eth",
      collectionSlug: "curvefields",
      algorithmHash: hashJson({ sketch: "code" }),
      seed: createSeed("1"),
      paramsHash,
    });

    expect(paramsHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(uniqueness).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
