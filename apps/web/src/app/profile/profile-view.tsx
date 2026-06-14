"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Package, Sparkles, UserCircle } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { type PublicClient, isAddress } from "viem";
import { StatusPill } from "@/components/status-pill";
import { artNamespaceFactoryAbi, artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { getFactoryAddress } from "@/lib/constants";
import { truncateMiddle } from "@/lib/format";
import { formatMintPrice } from "@/lib/price";
import { useAccountDisplay } from "@/lib/use-account-display";
import { walrusDirectUrl, walrusProxyUrl } from "@/lib/walrus";

type ProjectSummary = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  artistENS: string;
  collectionENS: string;
  owner: `0x${string}`;
  algorithmURI: string;
  nextTokenId: number;
  mintPriceWei: bigint;
};

type OwnedItem = {
  project: ProjectSummary;
  tokenId: number;
  artworkENS: string;
  metadataURI: string;
  imageURI?: string;
};

function asAddress(value: string): `0x${string}` | null {
  return isAddress(value) ? value : null;
}

async function readProjectSummary(client: PublicClient, address: `0x${string}`): Promise<ProjectSummary> {
  const [name, symbol, artistENS, collectionENS, owner, algorithmURI, nextTokenId, mintPriceWei] = await Promise.all([
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "name",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "symbol",
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
      functionName: "owner",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "algorithmURI",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "nextTokenId",
    }),
    client.readContract({
      address,
      abi: artNamespaceProjectAbi,
      functionName: "mintPriceWei",
    }),
  ]);

  return {
    address,
    name,
    symbol,
    artistENS,
    collectionENS,
    owner,
    algorithmURI,
    nextTokenId: Number(nextTokenId),
    mintPriceWei,
  };
}

async function readMetadataImage(metadataURI: string) {
  try {
    const response = await fetch(walrusProxyUrl(metadataURI));
    if (!response.ok) return undefined;
    const metadata = (await response.json()) as { image?: string };
    return metadata.image;
  } catch {
    return undefined;
  }
}

async function readOwnedItems(client: PublicClient, wallet: `0x${string}`, project: ProjectSummary) {
  const tokenIds = Array.from({ length: Math.max(project.nextTokenId - 1, 0) }, (_, index) => index + 1);
  const items = await Promise.all(
    tokenIds.map(async (tokenId): Promise<OwnedItem | null> => {
      try {
        const owner = await client.readContract({
          address: project.address,
          abi: artNamespaceProjectAbi,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        });

        if (owner.toLowerCase() !== wallet.toLowerCase()) {
          return null;
        }

        const [artworkENS, metadataURI] = await Promise.all([
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

        return {
          project,
          tokenId,
          artworkENS,
          metadataURI,
          imageURI: await readMetadataImage(metadataURI),
        };
      } catch {
        return null;
      }
    }),
  );

  return items.filter((item): item is OwnedItem => Boolean(item));
}

export function ProfileView() {
  const { address } = useAccount();
  const { displayName, ensName } = useAccountDisplay(address);
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const factory = getFactoryAddress();
  const [createdProjects, setCreatedProjects] = useState<ProjectSummary[]>([]);
  const [ownedItems, setOwnedItems] = useState<OwnedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Connect a Sepolia wallet to load your profile");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!address || !publicClient) {
        setCreatedProjects([]);
        setOwnedItems([]);
        setStatus("Connect a Sepolia wallet to load your profile");
        return;
      }

      if (!factory) {
        setError("Set NEXT_PUBLIC_ARTNAMESPACE_FACTORY to load profile data.");
        return;
      }

      setLoading(true);
      setError(null);
      setStatus("Reading ArtNamespace contracts");

      try {
        const [projectCount, artistProjects] = await Promise.all([
          publicClient.readContract({
            address: factory,
            abi: artNamespaceFactoryAbi,
            functionName: "allProjectsLength",
          }),
          publicClient.readContract({
            address: factory,
            abi: artNamespaceFactoryAbi,
            functionName: "projectsByArtist",
            args: [address],
          }),
        ]);

        const allProjects = await Promise.all(
          Array.from({ length: Number(projectCount) }, (_, index) =>
            publicClient.readContract({
              address: factory,
              abi: artNamespaceFactoryAbi,
              functionName: "allProjects",
              args: [BigInt(index)],
            }),
          ),
        );
        const uniqueProjects = Array.from(new Set([...allProjects, ...artistProjects].map((project) => project.toLowerCase())))
          .map(asAddress)
          .filter((project): project is `0x${string}` => Boolean(project));
        const summaries = await Promise.all(uniqueProjects.map((project) => readProjectSummary(publicClient, project)));
        const created = summaries.filter((project) => project.owner.toLowerCase() === address.toLowerCase());
        const owned = (await Promise.all(summaries.map((project) => readOwnedItems(publicClient, address, project)))).flat();

        if (!cancelled) {
          setCreatedProjects(created);
          setOwnedItems(owned.sort((a, b) => a.project.collectionENS.localeCompare(b.project.collectionENS) || a.tokenId - b.tokenId));
          setStatus("Profile loaded from Sepolia");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("Profile could not be loaded");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [address, factory, publicClient]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="mb-8 border-b border-line pb-6">
        <StatusPill tone="good">Account</StatusPill>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="flex items-center gap-3 font-serif text-5xl">
              <UserCircle size={40} />
              {displayName}
            </h1>
            <p className="mt-3 font-mono text-xs text-neutral-600">
              {ensName && address ? `Wallet ${truncateMiddle(address, 8)}` : address || "No wallet connected"}
            </p>
          </div>
          <div className="text-sm text-neutral-700">
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
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Package size={18} />
            <h2 className="font-serif text-3xl">Created Collections</h2>
          </div>
          {createdProjects.length === 0 ? (
            <div className="border border-line p-5 text-sm text-neutral-600">No created collections found for this wallet.</div>
          ) : (
            <div className="space-y-4">
              {createdProjects.map((project) => (
                <article key={project.address} className="border border-line p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl">{project.name}</h3>
                      <p className="mt-1 font-mono text-xs text-neutral-600">{project.collectionENS}</p>
                    </div>
                    <span className="border border-line px-2 py-1 font-mono text-xs">{project.symbol}</span>
                  </div>
                  <dl className="mt-5 grid gap-3 font-mono text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-neutral-500">Contract</dt>
                      <dd>{truncateMiddle(project.address, 8)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Mint price</dt>
                      <dd>{formatMintPrice(project.mintPriceWei)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Minted</dt>
                      <dd>{Math.max(project.nextTokenId - 1, 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Artist</dt>
                      <dd>{project.artistENS}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link className="inline-flex border border-ink px-3 py-2 text-sm hover:bg-paper" href={`/collection/${project.collectionENS}`}>
                      Open Collection
                    </Link>
                    <a className="inline-flex items-center gap-2 border border-line px-3 py-2 text-sm hover:border-ink" href={walrusDirectUrl(project.algorithmURI)} target="_blank">
                      Algorithm on Walrus <ExternalLink size={15} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={18} />
            <h2 className="font-serif text-3xl">Owned Items</h2>
          </div>
          {ownedItems.length === 0 ? (
            <div className="border border-line p-5 text-sm text-neutral-600">No minted items found for this wallet.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {ownedItems.map((item) => (
                <article key={`${item.project.address}-${item.tokenId}`} className="border border-line bg-paper p-4">
                  {item.imageURI ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={item.artworkENS} className="aspect-square w-full border border-line object-contain" src={walrusProxyUrl(item.imageURI)} />
                  ) : (
                    <div className="grid aspect-square place-items-center border border-dashed border-neutral-400 text-neutral-500">No image</div>
                  )}
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <Link className="break-all font-mono text-xs underline-offset-4 hover:underline" href={`/art/${item.artworkENS}`}>
                        {item.artworkENS}
                      </Link>
                      <span className="font-mono text-xs text-neutral-500">#{item.tokenId}</span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-700">{item.project.name}</p>
                    <a className="mt-3 block truncate font-mono text-xs text-neutral-500 underline-offset-4 hover:underline" href={walrusDirectUrl(item.metadataURI)} target="_blank">
                      {item.metadataURI}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
