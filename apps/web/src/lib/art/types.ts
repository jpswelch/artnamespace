export type ParamSchemaValue =
  | {
      type: "color";
      mode: "palette";
      values: string[];
    }
  | {
      type: "number";
      min: number;
      max: number;
      step?: number;
    }
  | {
      type: "integer";
      min: number;
      max: number;
    }
  | {
      type: "boolean";
    };

export type ParamSchema = Record<string, ParamSchemaValue>;

export type ArtManifest = {
  name: string;
  slug: string;
  artistENS: string;
  description: string;
  renderer: "p5js";
  rendererVersion: string;
  aspectRatio: string;
  license: string;
  maxSupply: number;
};

export type ArtPackage = {
  manifest: ArtManifest;
  paramsSchema: ParamSchema;
  sketch: string;
  previewDataUrl?: string;
  readme?: string;
  sourceName: string;
  bundleBytes: Uint8Array;
};

export type GeneratedOutput = {
  seed: `0x${string}`;
  params: Record<string, unknown>;
  features: Record<string, string>;
  dataUrl: string;
  console: string[];
};

export type AlgorithmBundle = {
  version: "1.0";
  manifest: ArtManifest;
  paramsSchema: ParamSchema;
  sketch: string;
  previewDataUrl?: string;
  readme?: string;
  packageHash: `0x${string}`;
  createdAt: string;
};

export type WalrusUploadResult = {
  blobId: string;
  uri: string;
  objectId?: string;
  aggregatorUrl: string;
  raw: unknown;
};

export type CollectionRecord = {
  artistENS: string;
  collectionENS: string;
  manifest: ArtManifest;
  algorithmHash: `0x${string}`;
  codeURI: string;
  factory?: `0x${string}`;
  contract?: `0x${string}`;
  mintPriceWei: string;
  subnameRegistrar?: `0x${string}`;
  subnameParentNode?: `0x${string}`;
  artworkResolver?: `0x${string}`;
  publishedAt: string;
};

export type ProvenanceManifest = {
  version: "1.0";
  artistENS: string;
  collectionENS: string;
  artworkENS: string;
  tokenId: number;
  chainId: number;
  contract?: string;
  algorithmURI: string;
  algorithmHash: `0x${string}`;
  renderer: "p5js";
  rendererVersion: string;
  seed: `0x${string}`;
  paramsURI: string;
  paramsHash: `0x${string}`;
  renderURI: string;
  metadataURI: string;
  features: Record<string, string>;
  createdAt: string;
};
