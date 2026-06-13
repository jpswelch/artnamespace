import Link from "next/link";
import { getCollectionEns } from "@/lib/constants";
import { WalletButton } from "./wallet-button";

export function SiteHeader() {
  const collectionEns = getCollectionEns();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-gallery/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-serif text-xl tracking-normal text-ink">
          ArtNamespace
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-neutral-700 md:flex">
          <Link href={`/collection/${collectionEns}`} className="hover:text-ink">
            Explore
          </Link>
          <Link href="/create" className="hover:text-ink">
            Create
          </Link>
          <Link href="/docs/artist-template" className="hover:text-ink">
            Docs
          </Link>
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
