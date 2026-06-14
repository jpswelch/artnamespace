import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseArtPackage } from "./package";
import { sampleManifest, sampleParamsSchema, sampleSketch } from "./sample";

describe("parseArtPackage", () => {
  it("parses a valid package", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(sampleManifest("artnamespace-demo.eth")));
    zip.file("params.schema.json", JSON.stringify(sampleParamsSchema));
    zip.file("sketch.js", sampleSketch);
    const file = new File([await zip.generateAsync({ type: "blob" })], "curvefields.zip");

    const parsed = await parseArtPackage(file);

    expect(parsed.manifest.name).toBe("Curvefields");
    expect(parsed.sketch).toContain("window.ArtNamespace");
  });

  it("rejects a package missing required files", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", "{}");
    const file = new File([await zip.generateAsync({ type: "blob" })], "bad.zip");

    await expect(parseArtPackage(file)).rejects.toThrow("Missing required files");
  });
});
