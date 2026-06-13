import { sampleSketch } from "@/lib/art/sample";

export default function ArtistTemplatePage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="border-b border-line pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-neutral-600">Artist Template</p>
        <h1 className="mt-4 font-serif text-5xl">p5.js Package Format</h1>
        <p className="mt-3 leading-7 text-neutral-700">
          The MVP accepts ZIP packages containing a manifest, parameter schema, sketch, and optional preview/readme files.
        </p>
      </div>

      <section className="space-y-8 py-8">
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
        </div>

        <div>
          <h2 className="mb-3 font-serif text-3xl">Runtime contract</h2>
          <p className="mb-3 leading-7 text-neutral-700">
            Assign `window.ArtNamespace` with `setup`, `draw`, and optional `features`. Use `ctx.rand()` for all visual randomness.
          </p>
          <pre className="max-h-[520px] overflow-auto border border-line bg-paper p-4 text-sm">{sampleSketch}</pre>
        </div>
      </section>
    </main>
  );
}
