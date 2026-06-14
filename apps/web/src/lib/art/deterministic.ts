import { encodeAbiParameters, keccak256, toBytes, toHex } from "viem";
import type { ParamSchema } from "./types";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function hashJson(value: unknown): `0x${string}` {
  return keccak256(toHex(toBytes(canonicalJson(value))));
}

export function hashBytes(bytes: Uint8Array): `0x${string}` {
  return keccak256(toHex(bytes));
}

export function createSeed(input: string | number): `0x${string}` {
  return keccak256(toHex(toBytes(String(input))));
}

export function createPrng(seed: `0x${string}`): () => number {
  let state = Number.parseInt(seed.slice(2, 10), 16) || 0x6d2b79f5;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateParams(schema: ParamSchema, seed: `0x${string}`): Record<string, unknown> {
  const rand = createPrng(seed);
  const params: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema).sort(([a], [b]) => a.localeCompare(b))) {
    if (field.type === "color") {
      params[key] = field.values[Math.floor(rand() * field.values.length) % field.values.length];
    }

    if (field.type === "number") {
      const raw = field.min + rand() * (field.max - field.min);
      const step = field.step || 0.01;
      params[key] = Number((Math.round(raw / step) * step).toFixed(6));
    }

    if (field.type === "integer") {
      params[key] = Math.floor(field.min + rand() * (field.max - field.min + 1));
    }

    if (field.type === "boolean") {
      params[key] = rand() >= 0.5;
    }
  }

  return params;
}

export function createUniquenessHash(input: {
  artistENS: string;
  collectionSlug: string;
  algorithmHash: `0x${string}`;
  seed: `0x${string}`;
  paramsHash: `0x${string}`;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "artistENS", type: "string" },
        { name: "collectionSlug", type: "string" },
        { name: "algorithmHash", type: "bytes32" },
        { name: "seed", type: "bytes32" },
        { name: "paramsHash", type: "bytes32" },
      ],
      [input.artistENS, input.collectionSlug, input.algorithmHash, input.seed, input.paramsHash],
    ),
  );
}

export function dataUrlToBase64(dataUrl: string) {
  const [, meta = "", payload = ""] = dataUrl.match(/^data:([^;]+);base64,(.*)$/) || [];
  return {
    contentType: meta || "application/octet-stream",
    base64: payload,
  };
}
