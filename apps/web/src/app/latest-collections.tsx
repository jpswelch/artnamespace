"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { artNamespaceFactoryAbi, artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { getFactoryAddress } from "@/lib/constants";
import { truncateMiddle } from "@/lib/format";
import { formatMintPrice } from "@/lib/price";
import { walrusProxyUrl } from "@/lib/walrus";
import type { AlgorithmBundle } from "@/lib/art/types";

type LatestCollection = {
  address: `0x${string}`;
  name: string;
  artistENS: string;
  collectionENS: string;
  nextTokenId: number;
  maxSupply: number;
  mintPriceWei: bigint;
  algorithmURI: string;
  previewSrc?: string;
};

async function readCollection(client: NonNullable<ReturnType<typeof usePublicClient>>, address: `0x${string}`) {
  const [name, artistENS, collectionENS, nextTokenId, maxSupply, mintPriceWei, algorithmURI] = await Promise.all([
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "name",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "artistENS",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "collectionENS",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "nextTokenId",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "maxSupply",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "mintPriceWei",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "algorithmURI",
    }),
  ]);

  const previewSrc = await readPackagePreview(algorithmURI).catch(() => undefined);

  return {
    address,
    name,
    artistENS,
    collectionENS,
    nextTokenId: Number(nextTokenId),
    maxSupply: Number(maxSupply),
    mintPriceWei,
    algorithmURI,
    previewSrc,
  };
}

async function readPackagePreview(algorithmURI: string) {
  if (!algorithmURI) return undefined;

  const response = await fetch(walrusProxyUrl(algorithmURI));
  if (!response.ok) return undefined;

  const bundle = (await response.json()) as AlgorithmBundle;
  return bundle.previewDataUrl || undefined;
}

export function LatestCollections() {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const factory = getFactoryAddress();
  const [collections, setCollections] = useState<LatestCollection[]>([]);
  const [status, setStatus] = useState("Reading latest collections");
  const [loading, setLoading] = useState(Boolean(factory));

  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      if (!publicClient || !factory) {
        setLoading(false);
        setStatus("Factory not configured");
        return;
      }

      setLoading(true);
      setStatus("Reading latest collections");

      try {
        const count = Number(
          await publicClient.readContract({
            address: factory,
            abi: artNamespaceFactoryAbi,
            functionName: "allProjectsLength",
          }),
        );
        const indexes = Array.from({ length: Math.min(count, 6) }, (_, index) => BigInt(count - index - 1));
        const addresses = await Promise.all(
          indexes.map((index) =>
            publicClient.readContract({
              address: factory,
              abi: artNamespaceFactoryAbi,
              functionName: "allProjects",
              args: [index],
            }),
          ),
        );
        const latest = await Promise.all(addresses.map((address) => readCollection(publicClient, address)));

        if (!cancelled) {
          setCollections(latest);
          setStatus(latest.length ? "Latest collections loaded" : "No collections published yet");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Could not load latest collections");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, [factory, publicClient]);

  return (
    <section id="collections" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-neutral-600">Live from Sepolia</p>
            <h2 className="mt-2 font-serif text-4xl">Latest Collections</h2>
          </div>
          <div className="text-sm text-neutral-600">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                Reading factory
              </span>
            ) : (
              status
            )}
          </div>
        </div>

        {collections.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => {
              const minted = Math.max(collection.nextTokenId - 1, 0);
              return (
                <article key={collection.address} className="border border-line bg-gallery">
                  {collection.previewSrc ? (
                    <Link href={`/collection/${collection.collectionENS}`} className="block">
                      <Image
                        alt={`${collection.name} preview`}
                        className="aspect-square w-full object-cover"
                        height={720}
                        src={collection.previewSrc}
                        unoptimized
                        width={720}
                      />
                    </Link>
                  ) : (
                    <div className="grid aspect-square place-items-center border-b border-line bg-paper p-5 text-center text-sm text-neutral-600">
                      Package preview unavailable
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-2xl">{collection.name}</h3>
                        <p className="mt-1 break-all font-mono text-xs text-neutral-600">{collection.collectionENS}</p>
                      </div>
                      <span className="border border-line px-2 py-1 font-mono text-xs">{formatMintPrice(collection.mintPriceWei)}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-3 font-mono text-xs">
                      <div>
                        <dt className="text-neutral-500">Artist</dt>
                        <dd className="truncate">{collection.artistENS}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Minted</dt>
                        <dd>
                          {minted}/{collection.maxSupply}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Contract</dt>
                        <dd>{truncateMiddle(collection.address, 5)}</dd>
                      </div>
                    </dl>
                    <Link className="mt-5 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline" href={`/collection/${collection.collectionENS}`}>
                      Open collection <ArrowRight size={15} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-neutral-400 p-5 text-sm text-neutral-600">
            Published collections from the configured factory will appear here.
          </div>
        )}
      </div>
    </section>
  );
}
