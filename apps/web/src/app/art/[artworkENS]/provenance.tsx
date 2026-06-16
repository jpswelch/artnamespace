"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { zeroAddress, type PublicClient } from "viem";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { fetchArtworkMetadata, metadataFeatures } from "@/lib/art/metadata";
import { artNamespaceFactoryAbi, artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { ENS_TEXT_KEYS, getFactoryAddress, parseArtworkEns } from "@/lib/constants";
import { loadArtwork } from "@/lib/local-cache";
import type { ProvenanceManifest } from "@/lib/art/types";
import { resolveProjectContract } from "@/lib/project";
import { walrusProxyUrl } from "@/lib/walrus";

type OnchainArtwork = {
  tokenId: number;
  collectionENS: string;
  contract: `0x${string}`;
  owner: `0x${string}`;
  metadataURI: string;
  imageURI?: string;
  features: Record<string, string>;
};

function compactRecords(records: Record<string, string>) {
  return Object.fromEntries(Object.entries(records).filter(([, value]) => value.length > 0));
}

async function resolveProjectContractForCollection(client: PublicClient, collectionENS: string, records: Record<string, string>) {
  const fromEns = resolveProjectContract(records);
  if (fromEns) return fromEns;

  const factory = getFactoryAddress();
  if (!factory) return undefined;

  const collectionHash = await client.readContract({
    address: factory,
    abi: artNamespaceFactoryAbi,
    functionName: "hashCollectionENS",
    args: [collectionENS],
  });
  const project = await client.readContract({
    address: factory,
    abi: artNamespaceFactoryAbi,
    functionName: "projectForCollectionHash",
    args: [collectionHash],
  });

  return project === zeroAddress ? undefined : project;
}

async function readOnchainArtwork(client: PublicClient, artworkENS: string): Promise<OnchainArtwork | null> {
  const parsed = parseArtworkEns(artworkENS);
  if (!parsed) return null;

  const { readEnsTextRecords } = await import("@/lib/ens");
  const collectionRecords = compactRecords(
    await readEnsTextRecords({
      name: parsed.collectionENS,
      keys: [ENS_TEXT_KEYS.projectContract, ENS_TEXT_KEYS.contract],
    }),
  );
  const contract = await resolveProjectContractForCollection(client, parsed.collectionENS, collectionRecords);
  if (!contract) return null;

  const [owner, tokenENS, metadataURI] = await Promise.all([
    client.readContract({
      address: contract,
      abi: artNamespaceProjectAbi,
      functionName: "ownerOf",
      args: [BigInt(parsed.tokenId)],
    }),
    client.readContract({
      address: contract,
      abi: artNamespaceProjectAbi,
      functionName: "tokenENS",
      args: [BigInt(parsed.tokenId)],
    }),
    client.readContract({
      address: contract,
      abi: artNamespaceProjectAbi,
      functionName: "tokenURI",
      args: [BigInt(parsed.tokenId)],
    }),
  ]);

  if (tokenENS.toLowerCase() !== artworkENS.toLowerCase()) return null;

  const metadata = await fetchArtworkMetadata(metadataURI);

  return {
    tokenId: parsed.tokenId,
    collectionENS: parsed.collectionENS,
    contract,
    owner,
    metadataURI,
    imageURI: metadata?.image,
    features: metadataFeatures(metadata),
  };
}

export function ArtworkProvenance({ artworkENS }: { artworkENS: string }) {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const [records, setRecords] = useState<Record<string, string>>({});
  const [manifest, setManifest] = useState<ProvenanceManifest | null>(null);
  const [onchainArtwork, setOnchainArtwork] = useState<OnchainArtwork | null>(null);
  const [status, setStatus] = useState("Reading ENS records");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = loadArtwork(artworkENS);
      let nextManifest = local;
      let nextRecords: Record<string, string> = {};

      if (local && !cancelled) setManifest(local);

      try {
        const { readEnsTextRecords } = await import("@/lib/ens");
        const ensRecords = compactRecords(await readEnsTextRecords({
          name: artworkENS,
          keys: [
            ENS_TEXT_KEYS.tokenId,
            ENS_TEXT_KEYS.seed,
            ENS_TEXT_KEYS.paramsHash,
            ENS_TEXT_KEYS.metadataURI,
            ENS_TEXT_KEYS.renderURI,
            ENS_TEXT_KEYS.algorithmHash,
            ENS_TEXT_KEYS.projectContract,
            ENS_TEXT_KEYS.contract,
            ENS_TEXT_KEYS.manifestURI,
          ],
        }));
        nextRecords = ensRecords;
        if (!cancelled) setRecords(ensRecords);
        const manifestUri = ensRecords[ENS_TEXT_KEYS.manifestURI];
        if (manifestUri) {
          const response = await fetch(walrusProxyUrl(manifestUri));
          if (response.ok) {
            nextManifest = (await response.json()) as ProvenanceManifest;
            if (!cancelled) setManifest(nextManifest);
          }
        }
        if (!cancelled) {
          setStatus(Object.keys(ensRecords).length ? "ENS and Walrus records loaded" : local ? "Showing locally cached provenance" : "No ENS artwork records found");
        }
      } catch {
        if (!cancelled) setStatus(local ? "Showing locally cached provenance" : "ENS records unavailable");
      }

      if (publicClient && (!nextManifest || !nextRecords[ENS_TEXT_KEYS.renderURI])) {
        const onchain = await readOnchainArtwork(publicClient, artworkENS).catch(() => null);
        if (onchain && !cancelled) {
          setOnchainArtwork(onchain);
          setRecords((current) => ({
            ...current,
            [ENS_TEXT_KEYS.tokenId]: String(onchain.tokenId),
            [ENS_TEXT_KEYS.metadataURI]: onchain.metadataURI,
            ...(onchain.imageURI ? { [ENS_TEXT_KEYS.renderURI]: onchain.imageURI } : {}),
            [ENS_TEXT_KEYS.projectContract]: onchain.contract,
            [ENS_TEXT_KEYS.contract]: onchain.contract,
          }));
          setStatus("Loaded from on-chain token metadata; ENS artwork records are missing");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [artworkENS, publicClient]);

  const renderURI = records[ENS_TEXT_KEYS.renderURI] || manifest?.renderURI || onchainArtwork?.imageURI;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 border-b border-line pb-6">
        <StatusPill tone="good">Provenance</StatusPill>
        <h1 className="mt-4 break-words font-serif text-5xl">{artworkENS}</h1>
        <p className="mt-3 text-neutral-700">{status}</p>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="border border-line bg-paper p-4">
          {renderURI ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={artworkENS} className="aspect-square w-full object-contain" src={walrusProxyUrl(renderURI)} />
          ) : (
            <div className="grid aspect-square place-items-center border border-dashed border-neutral-400 text-neutral-500">No render URI yet</div>
          )}
        </div>

        <aside className="space-y-6">
          {manifest ? (
            <div className="border border-line p-4">
              <h2 className="font-serif text-2xl">Manifest</h2>
              <dl className="mt-4 space-y-3 font-mono text-xs">
                <div>
                  <dt className="text-neutral-500">Artist</dt>
                  <dd>{manifest.artistENS}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Collection</dt>
                  <dd>{manifest.collectionENS}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Token</dt>
                  <dd>{manifest.tokenId}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Features</dt>
                  <dd>{Object.entries(manifest.features).map(([key, value]) => `${key}: ${value}`).join(" / ")}</dd>
                </div>
              </dl>
            </div>
          ) : onchainArtwork ? (
            <div className="border border-line p-4">
              <h2 className="font-serif text-2xl">On-chain Metadata</h2>
              <dl className="mt-4 space-y-3 font-mono text-xs">
                <div>
                  <dt className="text-neutral-500">Collection</dt>
                  <dd>{onchainArtwork.collectionENS}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Token</dt>
                  <dd>{onchainArtwork.tokenId}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Owner</dt>
                  <dd>{onchainArtwork.owner}</dd>
                </div>
                {Object.keys(onchainArtwork.features).length ? (
                  <div>
                    <dt className="text-neutral-500">Features</dt>
                    <dd>{Object.entries(onchainArtwork.features).map(([key, value]) => `${key}: ${value}`).join(" / ")}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          <div>
            <h2 className="mb-3 font-serif text-2xl">ENS text records</h2>
            <RecordTable records={records} />
          </div>
        </aside>
      </section>
    </main>
  );
}
