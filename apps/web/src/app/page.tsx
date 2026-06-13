import Link from "next/link";
import { ArrowRight, Database, Fingerprint, Sparkles } from "lucide-react";
import { getCollectionEns } from "@/lib/constants";

export default function HomePage() {
  const collectionEns = getCollectionEns();

  return (
    <main>
      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl content-center gap-12 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-neutral-600">ENS-native provenance for creative code</p>
            <h1 className="font-serif text-5xl leading-[1.02] tracking-normal text-ink md:text-7xl">
              Generative art with resolvable names.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-700">
              Publish creative-code algorithms under an artist ENS name. Collectors mint unique outputs, each with its own artwork
              subname, NFT, deterministic parameters, and Walrus storage record.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm text-white hover:bg-black">
                Create a Collection <ArrowRight size={16} />
              </Link>
              <Link href={`/collection/${collectionEns}`} className="inline-flex items-center gap-2 border border-ink px-5 py-3 text-sm hover:bg-white">
                Mint Demo Piece
              </Link>
            </div>
          </div>
          <div className="self-end border border-line bg-gallery p-4">
            <div className="aspect-square border border-line bg-[radial-gradient(circle_at_20%_10%,#f1d7b5,transparent_24%),linear-gradient(135deg,#fffdf8,#f7f4ef)] p-8">
              <div className="grid h-full place-items-center border border-dashed border-neutral-400 text-center">
                <div>
                  <p className="font-serif text-4xl">Curvefields</p>
                  <p className="mt-3 font-mono text-xs text-neutral-600">{collectionEns}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:grid-cols-3">
        {[
          ["Upload Algorithm", "Artists upload deterministic p5.js packages and preview seeded outputs before publishing.", Sparkles],
          ["Store on Walrus", "Algorithm bundles, renders, params, metadata, and manifests are written to Walrus Testnet.", Database],
          ["Name with ENS", "Collection and artwork ENS records are written and read back as provenance, not decoration.", Fingerprint],
        ].map(([title, body, Icon]) => (
          <article key={String(title)} className="border-t border-line pt-5">
            <Icon className="mb-6 text-accent" size={24} />
            <h2 className="font-serif text-2xl">{title as string}</h2>
            <p className="mt-3 leading-7 text-neutral-700">{body as string}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
