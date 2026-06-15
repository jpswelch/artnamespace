import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Database, Fingerprint, PackagePlus, Sparkles } from "lucide-react";
import { LatestCollections } from "./latest-collections";
import { LatestMintedWorks } from "./latest-minted-works";

export default function HomePage() {
  return (
    <main>
      <section className="border-b border-line bg-gallery">
        <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-[0.94fr_1.06fr]">
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-neutral-600">ENS-native provenance for creative code</p>
            <h1 className="max-w-3xl font-serif text-5xl leading-[1.02] tracking-normal text-ink md:text-7xl">
              Generative collections with names you can resolve.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-700">
              ArtNamespace publishes creative-code projects as artist-owned ERC-721 collections, stores the algorithm and minted artifacts
              on Walrus, and connects each collection and artwork to ENS.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm text-white hover:bg-black">
                Create Collection <PackagePlus size={16} />
              </Link>
              <Link href="#collections" className="inline-flex items-center gap-2 border border-ink px-5 py-3 text-sm hover:bg-paper">
                View Collections <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="relative">
            <Image
              alt="Generative collection preview"
              className="aspect-square w-full border border-line object-cover"
              height={960}
              priority
              src="/previews/curvefields.png?v=b88dd0c9"
              unoptimized
              width={960}
            />
            <div className="absolute bottom-0 left-0 right-0 border-t border-line bg-gallery/90 p-4 backdrop-blur">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-serif text-3xl">Fresh collection namespace</p>
                  <p className="mt-1 font-mono text-xs text-neutral-600">Publish from your ENS name, then mint numbered artwork subnames.</p>
                </div>
                <Link className="inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline" href="/create">
                  Create <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LatestMintedWorks />
      <LatestCollections />

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-3">
        {[
          ["Create the collection", "Upload a deterministic p5.js package and deploy its own ERC-721 contract.", Sparkles],
          ["Store the artifacts", "Write algorithm bundles, minted renders, params, metadata, and manifests to Walrus.", Database],
          ["Resolve the names", "Use ENS records for the artist, collection, and each minted artwork.", Fingerprint],
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
