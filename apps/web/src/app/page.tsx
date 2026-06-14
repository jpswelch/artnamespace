import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Database, Fingerprint, PackagePlus, Sparkles } from "lucide-react";
import { LatestCollections } from "./latest-collections";
import { FEATURED_PACKAGES } from "@/lib/package-previews";

export default function HomePage() {
  const heroPackage = FEATURED_PACKAGES[0];

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
              ArtNamespace publishes creative-code packages as artist-owned ERC-721 collections, stores the algorithm and minted artifacts
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
              alt={`${heroPackage.name} preview`}
              className="aspect-square w-full border border-line object-cover"
              height={960}
              priority
              src={heroPackage.previewSrc}
              unoptimized
              width={960}
            />
            <div className="absolute bottom-0 left-0 right-0 border-t border-line bg-gallery/90 p-4 backdrop-blur">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-serif text-3xl">{heroPackage.name}</p>
                  <p className="mt-1 font-mono text-xs text-neutral-600">{heroPackage.collectionENS}</p>
                </div>
                <Link className="inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline" href={`/collection/${heroPackage.collectionENS}`}>
                  Open <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-neutral-600">Artist packages</p>
            <h2 className="mt-2 font-serif text-4xl">Available Packages</h2>
          </div>
          <Link className="inline-flex items-center gap-2 border border-line px-4 py-2 text-sm hover:border-ink" href="/create">
            Add package <PackagePlus size={15} />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {FEATURED_PACKAGES.map((pkg) => (
            <article key={pkg.slug} className="grid border border-line bg-paper md:grid-cols-[220px_1fr]">
              <Link href={`/collection/${pkg.collectionENS}`} className="block">
                <Image
                  alt={`${pkg.name} preview`}
                  className="aspect-square h-full w-full object-cover"
                  height={520}
                  src={pkg.previewSrc}
                  unoptimized
                  width={520}
                />
              </Link>
              <div className="flex min-h-[220px] flex-col justify-between p-5">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-serif text-3xl">{pkg.name}</h3>
                    <span className="border border-line px-2 py-1 font-mono text-xs">{pkg.maxSupply} max</span>
                  </div>
                  <p className="mt-3 leading-7 text-neutral-700">{pkg.description}</p>
                </div>
                <div className="mt-5">
                  <p className="break-all font-mono text-xs text-neutral-600">{pkg.collectionENS}</p>
                  <Link className="mt-3 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline" href={`/collection/${pkg.collectionENS}`}>
                    Open collection <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <LatestCollections />

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-3">
        {[
          ["Publish the package", "Upload a deterministic p5.js package and deploy its own ERC-721 contract.", Sparkles],
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
