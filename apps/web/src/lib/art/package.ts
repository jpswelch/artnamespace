import JSZip from "jszip";
import { hashBytes } from "./deterministic";
import type { ArtManifest, ArtPackage, ParamSchema } from "./types";

const REQUIRED_FILES = ["manifest.json", "sketch.js", "params.schema.json"];

export async function parseArtPackage(file: File): Promise<ArtPackage> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const packageRoot = resolvePackageRoot(zip);
  const missing = REQUIRED_FILES.filter((name) => !zip.file(`${packageRoot}${name}`));

  if (missing.length > 0) {
    throw new Error(`Missing required file${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }

  const manifest = JSON.parse(await zip.file(`${packageRoot}manifest.json`)!.async("text")) as ArtManifest;
  const paramsSchema = JSON.parse(await zip.file(`${packageRoot}params.schema.json`)!.async("text")) as ParamSchema;
  const sketch = await zip.file(`${packageRoot}sketch.js`)!.async("text");
  const readme = zip.file(`${packageRoot}README.md`) ? await zip.file(`${packageRoot}README.md`)!.async("text") : undefined;
  const previewDataUrl = zip.file(`${packageRoot}preview.png`)
    ? `data:image/png;base64,${await zip.file(`${packageRoot}preview.png`)!.async("base64")}`
    : undefined;

  validateManifest(manifest);
  validateSchema(paramsSchema);

  if (!sketch.includes("window.ArtNamespace")) {
    throw new Error("sketch.js must assign window.ArtNamespace");
  }

  return {
    manifest,
    paramsSchema,
    sketch,
    readme,
    previewDataUrl,
    sourceName: file.name,
    bundleBytes: buffer,
  };
}

function resolvePackageRoot(zip: JSZip) {
  if (REQUIRED_FILES.every((name) => zip.file(name))) {
    return "";
  }

  const prefixes = new Set<string>();

  for (const path of Object.keys(zip.files)) {
    if (path.startsWith("__MACOSX/") || path.endsWith("/")) continue;

    const match = REQUIRED_FILES.find((name) => path.endsWith(`/${name}`));
    if (!match) continue;

    prefixes.add(path.slice(0, -match.length));
  }

  return Array.from(prefixes).find((prefix) => REQUIRED_FILES.every((name) => zip.file(`${prefix}${name}`))) || "";
}

export function validateManifest(manifest: ArtManifest) {
  const required: Array<keyof ArtManifest> = [
    "name",
    "slug",
    "artistENS",
    "description",
    "renderer",
    "rendererVersion",
    "aspectRatio",
    "license",
    "maxSupply",
  ];

  for (const key of required) {
    if (manifest[key] === undefined || manifest[key] === null || manifest[key] === "") {
      throw new Error(`manifest.json missing ${key}`);
    }
  }

  if (manifest.renderer !== "p5js") {
    throw new Error("MVP renderer must be p5js");
  }

  if (!Number.isInteger(manifest.maxSupply) || manifest.maxSupply <= 0) {
    throw new Error("manifest maxSupply must be a positive integer");
  }
}

export function validateSchema(schema: ParamSchema) {
  for (const [key, field] of Object.entries(schema)) {
    if (!field.type) {
      throw new Error(`params.schema.json field ${key} is missing type`);
    }

    if (field.type === "color" && (!Array.isArray(field.values) || field.values.length === 0)) {
      throw new Error(`color field ${key} must include palette values`);
    }

    if ((field.type === "number" || field.type === "integer") && field.max <= field.min) {
      throw new Error(`numeric field ${key} must have max greater than min`);
    }
  }
}

export function packageHash(pkg: ArtPackage): `0x${string}` {
  return hashBytes(pkg.bundleBytes);
}
