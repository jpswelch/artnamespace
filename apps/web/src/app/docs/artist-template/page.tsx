import { sampleManifest, sampleParamsSchema, sampleSketch } from "@/lib/art/sample";

const manifestExample = JSON.stringify(sampleManifest("artist.eth"), null, 2);
const paramsSchemaExample = JSON.stringify(sampleParamsSchema, null, 2);

const fileNotes = [
  {
    name: "manifest.json",
    status: "required",
    text: "Collection metadata. The slug becomes the collection subname, such as curvefields.artist.eth. artistENS can be a placeholder while drafting; the create flow replaces it with the ENS root you enter before publishing.",
  },
  {
    name: "params.schema.json",
    status: "required",
    text: "The list of traits ArtNamespace can generate for each mint. Every key becomes available in sketch.js as ctx.params.keyName.",
  },
  {
    name: "sketch.js",
    status: "required",
    text: "The drawing code. It must assign window.ArtNamespace and include draw(ctx). setup(ctx) and features(ctx) are optional.",
  },
  {
    name: "preview.png",
    status: "optional",
    text: "A representative render from the project. If present, it appears while reviewing the package before publishing.",
  },
  {
    name: "README.md",
    status: "optional",
    text: "Human notes for the artist, collector, or curator. It is stored with the algorithm bundle but does not change rendering.",
  },
];

export default function ArtistTemplatePage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="border-b border-line pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-neutral-600">Artist Template</p>
        <h1 className="mt-4 font-serif text-5xl">p5.js Package Format</h1>
        <p className="mt-3 leading-7 text-neutral-700">
          Create one ZIP file with a manifest, parameter schema, and sketch. Add a preview image and README when you want collectors to see
          more context before minting.
        </p>
      </div>

      <section className="space-y-10 py-8">
        <div>
          <h2 className="mb-3 font-serif text-3xl">ZIP structure</h2>
          <pre className="overflow-auto border border-line bg-paper p-4 text-sm">
{`art-project.zip
├── manifest.json
├── sketch.js
├── params.schema.json
├── preview.png
└── README.md`}
          </pre>
          <p className="mt-3 leading-7 text-neutral-700">
            The three required files are <code>manifest.json</code>, <code>params.schema.json</code>, and <code>sketch.js</code>. The ZIP can
            contain those files at the top level or inside one project folder.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">Start from a folder</h2>
          <ol className="space-y-3 leading-7 text-neutral-700">
            <li>1. Make a folder for one collection, such as <code>curvefields</code>.</li>
            <li>2. Add <code>manifest.json</code>, <code>params.schema.json</code>, and <code>sketch.js</code>.</li>
            <li>3. Add <code>preview.png</code> and <code>README.md</code> if you have them.</li>
            <li>4. Zip the files and upload the ZIP on the Create page.</li>
          </ol>
          <pre className="mt-4 overflow-auto border border-line bg-paper p-4 text-sm">
{`cd curvefields
zip -r curvefields.zip manifest.json params.schema.json sketch.js preview.png README.md`}
          </pre>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">What each file does</h2>
          <div className="divide-y divide-line border border-line">
            {fileNotes.map((file) => (
              <div className="grid gap-3 p-4 md:grid-cols-[180px_1fr]" key={file.name}>
                <div>
                  <p className="font-mono text-sm">{file.name}</p>
                  <p className="mt-1 font-mono text-xs uppercase text-neutral-500">{file.status}</p>
                </div>
                <p className="leading-7 text-neutral-700">{file.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">manifest.json</h2>
          <p className="mb-3 leading-7 text-neutral-700">
            This file describes the collection. Keep <code>renderer</code> as <code>p5js</code>. Use a short lowercase <code>slug</code> with
            no spaces because it becomes part of the collection name.
          </p>
          <pre className="overflow-auto border border-line bg-paper p-4 text-sm">{manifestExample}</pre>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">params.schema.json</h2>
          <p className="mb-3 leading-7 text-neutral-700">
            This file defines the variables ArtNamespace generates for each output. Supported field types are <code>color</code>,{" "}
            <code>number</code>, <code>integer</code>, and <code>boolean</code>. Numeric fields need <code>min</code> and <code>max</code>, and
            color fields need a <code>values</code> palette.
          </p>
          <pre className="overflow-auto border border-line bg-paper p-4 text-sm">{paramsSchemaExample}</pre>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">Runtime contract</h2>
          <p className="mb-3 leading-7 text-neutral-700">
            Assign <code>window.ArtNamespace</code> in <code>sketch.js</code>. The renderer calls <code>setup(ctx)</code> once if it exists,
            then <code>draw(ctx)</code>. Use <code>ctx.rand()</code> for visual randomness so the same seed always produces the same image.
          </p>
          <div className="mb-3 grid gap-3 text-sm leading-6 text-neutral-700 md:grid-cols-2">
            <div className="border border-line p-3">
              <p className="font-mono text-xs uppercase text-neutral-500">ctx includes</p>
              <p className="mt-2"><code>p5</code>, <code>seed</code>, <code>rand</code>, <code>params</code>, <code>tokenId</code>, <code>artistENS</code>, <code>collectionENS</code>, <code>artworkENS</code></p>
            </div>
            <div className="border border-line p-3">
              <p className="font-mono text-xs uppercase text-neutral-500">features(ctx)</p>
              <p className="mt-2">Return simple trait labels to show on minted artwork pages. Use strings, numbers, or values that can be displayed as text.</p>
            </div>
          </div>
          <pre className="max-h-[520px] overflow-auto border border-line bg-paper p-4 text-sm">{sampleSketch}</pre>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">README.md</h2>
          <p className="mb-3 leading-7 text-neutral-700">
            Use the README for plain-language context: what the work is, how it was made, what the parameters mean, and any license or
            exhibition notes. It can be short.
          </p>
          <pre className="overflow-auto border border-line bg-paper p-4 text-sm">
{`# Curvefields

A deterministic p5.js collection exploring curves, density, symmetry, and motion.

Parameters:

- background: palette used behind the drawing
- foreground: stroke palette
- density: number of curve groups
- symmetry: number of repeated arms
- loop: still or motion study

License: CC BY-NC 4.0`}
          </pre>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">Common checks</h2>
          <ul className="space-y-3 leading-7 text-neutral-700">
            <li>Make sure <code>sketch.js</code> contains <code>window.ArtNamespace = {"{ ... }"}</code>.</li>
            <li>Make sure every value you read from <code>ctx.params</code> exists in <code>params.schema.json</code>.</li>
            <li>Use <code>ctx.rand()</code> instead of <code>Math.random()</code>.</li>
            <li>Call <code>p5.createCanvas()</code> in <code>setup(ctx)</code>.</li>
            <li>Keep the ZIP small enough to upload comfortably. Large generated images should not be placed inside the package.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
