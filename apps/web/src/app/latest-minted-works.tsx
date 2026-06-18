"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import type { PublicClient } from "viem";
import { fetchArtworkMetadata } from "@/lib/art/metadata";
import { artNamespaceFactoryAbi, artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { getFactoryAddress } from "@/lib/constants";
import { truncateMiddle } from "@/lib/format";
import { latestMintedTokenIds } from "@/lib/project";
import { walrusDirectUrl, walrusProxyUrl } from "@/lib/walrus";

const MAX_WORKS = 8;

// TODO: Replace this best-effort contract scan with an ArtworkMinted event indexer/cache
// so works can be globally sorted by block time and served faster.
type ProjectSnapshot = {
  address: `0x${string}`;
  name: string;
  collectionENS: string;
  nextTokenId: number;
  projectRank: number;
};

type LatestMintedWork = {
  project: `0x${string}`;
  projectRank: number;
  tokenId: number;
  name: string;
  collectionName: string;
  collectionENS: string;
  artworkENS: string;
  owner: `0x${string}`;
  metadataURI: string;
  imageURI?: string;
};

async function readProjectSnapshot(client: PublicClient, address: `0x${string}`, projectRank: number): Promise<ProjectSnapshot | null> {
  try {
    const [name, collectionENS, nextTokenId] = await Promise.all([
      client.readContract({
        address,
        abi: artNamespaceProjectAbi,
        functionName: "name",
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
    ]);

    return {
      address,
      name,
      collectionENS,
      nextTokenId: Number(nextTokenId),
      projectRank,
    };
  } catch {
    return null;
  }
}

async function readMintedWork(client: PublicClient, project: ProjectSnapshot, tokenId: number): Promise<LatestMintedWork | null> {
  try {
    const [owner, artworkENS, metadataURI] = await Promise.all([
      client.readContract({
        address: project.address,
        abi: artNamespaceProjectAbi,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      }),
      client.readContract({
        address: project.address,
        abi: artNamespaceProjectAbi,
        functionName: "tokenENS",
        args: [BigInt(tokenId)],
      }),
      client.readContract({
        address: project.address,
        abi: artNamespaceProjectAbi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      }),
    ]);
    const metadata = await fetchArtworkMetadata(metadataURI);

    return {
      project: project.address,
      projectRank: project.projectRank,
      tokenId,
      name: metadata?.name || artworkENS,
      collectionName: project.name,
      collectionENS: project.collectionENS,
      artworkENS,
      owner,
      metadataURI,
      imageURI: metadata?.image,
    };
  } catch {
    return null;
  }
}

export function LatestMintedWorks() {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const factory = getFactoryAddress();
  const [works, setWorks] = useState<LatestMintedWork[]>([]);
  const [status, setStatus] = useState("Reading latest minted works");
  const [loading, setLoading] = useState(Boolean(factory));

  useEffect(() => {
    let cancelled = false;

    async function loadLatestMintedWorks() {
      if (!publicClient || !factory) {
        setLoading(false);
        setStatus("Factory not configured");
        return;
      }

      setLoading(true);
      setStatus("Reading latest minted works");

      try {
        const count = Number(
          await publicClient.readContract({
            address: factory,
            abi: artNamespaceFactoryAbi,
            functionName: "allProjectsLength",
          }),
        );
        const indexes = Array.from({ length: count }, (_, index) => count - index - 1);
        const projectAddresses = await Promise.all(
          indexes.map((index) =>
            publicClient.readContract({
              address: factory,
              abi: artNamespaceFactoryAbi,
              functionName: "allProjects",
              args: [BigInt(index)],
            }),
          ),
        );
        const projects = (await Promise.all(projectAddresses.map((address, projectRank) => readProjectSnapshot(publicClient, address, projectRank)))).filter(
          (project): project is ProjectSnapshot => Boolean(project && project.nextTokenId > 1),
        );

        const tokenReads = projects.flatMap((project) => {
          const tokenIds = latestMintedTokenIds(project.nextTokenId, MAX_WORKS);
          return tokenIds.map((tokenId) => readMintedWork(publicClient, project, tokenId));
        });
        const mintedWorks = (await Promise.all(tokenReads))
          .filter((work): work is LatestMintedWork => Boolean(work))
          .sort((a, b) => a.projectRank - b.projectRank || b.tokenId - a.tokenId)
          .slice(0, MAX_WORKS);

        if (!cancelled) {
          setWorks(mintedWorks);
          setStatus(mintedWorks.length ? "Latest minted works loaded" : "No minted works yet");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Could not load latest minted works");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLatestMintedWorks();

    return () => {
      cancelled = true;
    };
  }, [factory, publicClient]);

  return (
    <section className="border-t border-line bg-gallery">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-neutral-600">Freshly minted</p>
            <h2 className="mt-2 font-serif text-4xl">Latest Works</h2>
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

        {works.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {works.map((work) => (
              <article key={`${work.project}-${work.tokenId}`} className="border border-line bg-paper p-4">
                {work.imageURI ? (
                  <Link href={`/art/${work.artworkENS}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={work.name} className="aspect-square w-full border border-line object-contain" src={walrusProxyUrl(work.imageURI)} />
                  </Link>
                ) : (
                  <div className="grid aspect-square place-items-center border border-dashed border-neutral-400 text-sm text-neutral-500">No image</div>
                )}
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-1 font-serif text-2xl">{work.name}</h3>
                      <span className="font-mono text-xs text-neutral-500">#{work.tokenId}</span>
                    </div>
                    <Link className="mt-1 block break-all font-mono text-xs text-neutral-600 underline-offset-4 hover:underline" href={`/art/${work.artworkENS}`}>
                      {work.artworkENS}
                    </Link>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
                    <div>
                      <dt className="text-neutral-500">Collection</dt>
                      <dd className="truncate">{work.collectionName}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Collector</dt>
                      <dd>{truncateMiddle(work.owner, 6)}</dd>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between gap-3 text-xs text-neutral-600">
                    <Link className="underline-offset-4 hover:underline" href={`/collection/${work.collectionENS}`}>
                      Open collection
                    </Link>
                    <a
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                      href={walrusDirectUrl(work.metadataURI)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Metadata <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-neutral-400 p-5 text-sm text-neutral-600">
            {status === "No minted works yet" ? "Minted works from the configured factory will appear here." : status}
          </div>
        )}
      </div>
    </section>
  );
}
