import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseArtPackage } from "./package";
import { createAlgorithmBundle, sampleManifest, sampleParamsSchema, sampleSketch } from "./sample";

describe("parseArtPackage", () => {
  it("parses a valid package", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(sampleManifest("artnamespace-demo.eth")));
    zip.file("params.schema.json", JSON.stringify(sampleParamsSchema));
    zip.file("sketch.js", sampleSketch);
    zip.file("preview.png", "preview-bytes");
    const file = new File([await zip.generateAsync({ type: "blob" })], "curvefields.zip");

    const parsed = await parseArtPackage(file);

    expect(parsed.manifest.name).toBe("Curvefields");
    expect(parsed.sketch).toContain("window.ArtNamespace");
    expect(parsed.previewDataUrl).toBe("data:image/png;base64,cHJldmlldy1ieXRlcw==");
    expect(createAlgorithmBundle(parsed).previewDataUrl).toBe(parsed.previewDataUrl);
  });

  it("parses a package wrapped in a top-level folder", async () => {
    const zip = new JSZip();
    zip.file("lumenloom/manifest.json", JSON.stringify({ ...sampleManifest("knicks-won.eth"), name: "Lumen Loom", slug: "lumenloom" }));
    zip.file("lumenloom/params.schema.json", JSON.stringify(sampleParamsSchema));
    zip.file("lumenloom/sketch.js", sampleSketch);
    zip.file("__MACOSX/lumenloom/._manifest.json", "");
    const file = new File([await zip.generateAsync({ type: "blob" })], "lumenloom.zip");

    const parsed = await parseArtPackage(file);

    expect(parsed.manifest.name).toBe("Lumen Loom");
    expect(parsed.manifest.slug).toBe("lumenloom");
  });

  it("rejects a package missing required files", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", "{}");
    const file = new File([await zip.generateAsync({ type: "blob" })], "bad.zip");

    await expect(parseArtPackage(file)).rejects.toThrow("Missing required files");
  });
});
