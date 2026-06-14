"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import type { PublicClient } from "viem";
import { fetchArtworkMetadata, metadataFeatures } from "@/lib/art/metadata";
import { artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { truncateMiddle } from "@/lib/format";
import { walrusDirectUrl, walrusProxyUrl } from "@/lib/walrus";

type MintedArtwork = {
  tokenId: number;
  owner: `0x${string}`;
  artworkENS: string;
  metadataURI: string;
  imageURI?: string;
  features: Record<string, string>;
};

async function readMintedArtwork(client: PublicClient, projectContract: `0x${string}`, tokenId: number): Promise<MintedArtwork | null> {
  try {
    const [owner, artworkENS, metadataURI] = await Promise.all([
      client.readContract({
        address: projectContract,
        abi: artNamespaceProjectAbi,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      }),
      client.readContract({
        address: projectContract,
        abi: artNamespaceProjectAbi,
        functionName: "tokenENS",
        args: [BigInt(tokenId)],
      }),
      client.readContract({
        address: projectContract,
        abi: artNamespaceProjectAbi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      }),
    ]);
    const metadata = await fetchArtworkMetadata(metadataURI);

    return {
      tokenId,
      owner,
      artworkENS,
      metadataURI,
      imageURI: metadata?.image,
      features: metadataFeatures(metadata),
    };
  } catch {
    return null;
  }
}

export function CollectionArtworks({
  projectContract,
  refreshKey,
}: {
  projectContract: `0x${string}`;
  refreshKey: number;
}) {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const [artworks, setArtworks] = useState<MintedArtwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Reading minted works");

  useEffect(() => {
    let cancelled = false;

    async function loadArtworks() {
      if (!publicClient) return;

      setLoading(true);
      setStatus("Reading minted works");

      try {
        const nextTokenId = Number(
          await publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "nextTokenId",
          }),
        );
        const tokenIds = Array.from({ length: Math.max(nextTokenId - 1, 0) }, (_, index) => index + 1);
        const minted = (await Promise.all(tokenIds.map((tokenId) => readMintedArtwork(publicClient, projectContract, tokenId))))
          .filter((artwork): artwork is MintedArtwork => Boolean(artwork))
          .sort((a, b) => b.tokenId - a.tokenId);

        if (!cancelled) {
          setArtworks(minted);
          setStatus(minted.length ? "Minted works loaded from Sepolia" : "No minted works yet");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Could not load minted works");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadArtworks();

    return () => {
      cancelled = true;
    };
  }, [projectContract, publicClient, refreshKey]);

  return (
    <section className="mt-10 border-t border-line pt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <h2 className="font-serif text-3xl">Minted Works</h2>
        </div>
        <div className="text-sm text-neutral-600">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              Reading Sepolia
            </span>
          ) : (
            status
          )}
        </div>
      </div>

      {artworks.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {artworks.map((artwork) => (
            <article key={artwork.tokenId} className="border border-line bg-paper p-4">
              {artwork.imageURI ? (
                <Link href={`/art/${artwork.artworkENS}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={artwork.artworkENS} className="aspect-square w-full border border-line object-contain" src={walrusProxyUrl(artwork.imageURI)} />
                </Link>
              ) : (
                <div className="grid aspect-square place-items-center border border-dashed border-neutral-400 text-neutral-500">No image</div>
              )}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Link className="break-all font-mono text-xs underline-offset-4 hover:underline" href={`/art/${artwork.artworkENS}`}>
                    {artwork.artworkENS}
                  </Link>
                  <span className="font-mono text-xs text-neutral-500">#{artwork.tokenId}</span>
                </div>
                {Object.keys(artwork.features).length ? (
                  <p className="line-clamp-2 text-xs leading-5 text-neutral-700">
                    {Object.entries(artwork.features)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" / ")}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-3 font-mono text-xs text-neutral-500">
                  <span>{truncateMiddle(artwork.owner, 6)}</span>
                  <a className="inline-flex items-center gap-1 underline-offset-4 hover:underline" href={walrusDirectUrl(artwork.metadataURI)} target="_blank">
                    Metadata <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-neutral-400 p-5 text-sm text-neutral-600">{status}</div>
      )}
    </section>
  );
}
