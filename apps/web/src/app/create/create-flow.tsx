"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, FileUp, Loader2, Wand2 } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { isAddress, zeroAddress } from "viem";
import { RenderFrame } from "@/components/render-frame";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { createAlgorithmBundle, samplePackage } from "@/lib/art/sample";
import { createSeed, generateParams } from "@/lib/art/deterministic";
import { packageHash, parseArtPackage } from "@/lib/art/package";
import type { ArtPackage, CollectionRecord, GeneratedOutput } from "@/lib/art/types";
import { artNamespaceFactoryAbi, artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { ENS_TEXT_KEYS, getArtistEnsRoot, getCollectionEns, getFactoryAddress } from "@/lib/constants";
import { readEnsTextRecords, writeEnsTextRecords } from "@/lib/ens";
import { loadCollection, saveCollection } from "@/lib/local-cache";
import { truncateMiddle } from "@/lib/format";
import { collectionSymbol, resolveProjectContract } from "@/lib/project";
import { uploadWalrusArtifact } from "@/lib/walrus";

export function CreateFlow() {
  const artistRoot = getArtistEnsRoot();
  const [pkg, setPkg] = useState<ArtPackage>(() => samplePackage(artistRoot));
  const [outputs, setOutputs] = useState<Record<string, GeneratedOutput>>({});
  const [status, setStatus] = useState<string>("Sample package loaded");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<CollectionRecord | null>(null);
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });

  const collectionEns = getCollectionEns(pkg.manifest.artistENS || artistRoot);
  const algorithmHash = packageHash(pkg);
  const factory = getFactoryAddress();
  const seeds = useMemo(() => Array.from({ length: 6 }, (_, index) => createSeed(`preview-${index + 1}-${algorithmHash}`)), [algorithmHash]);

  useEffect(() => {
    let cancelled = false;

    async function restorePublishedState() {
      const local = loadCollection();
      const matchingLocal = local?.collectionENS === collectionEns ? local : null;

      if (matchingLocal?.contract) {
        if (!cancelled) {
          setPublished(matchingLocal);
          setStatus("Collection already published");
        }
        return;
      }

      if (!publicClient) return;

      try {
        const records = await readEnsTextRecords({
          client: publicClient,
          name: collectionEns,
          keys: [
            ENS_TEXT_KEYS.creator,
            ENS_TEXT_KEYS.collection,
            ENS_TEXT_KEYS.algorithmHash,
            ENS_TEXT_KEYS.codeURI,
            ENS_TEXT_KEYS.factory,
            ENS_TEXT_KEYS.projectContract,
            ENS_TEXT_KEYS.contract,
            ENS_TEXT_KEYS.mintPriceWei,
          ],
        });
        const projectContract = resolveProjectContract(records, matchingLocal);
        const codeURI = records[ENS_TEXT_KEYS.codeURI];
        const ensAlgorithmHash = records[ENS_TEXT_KEYS.algorithmHash];

        if (!projectContract || !codeURI || !ensAlgorithmHash?.startsWith("0x")) {
          return;
        }

        const ensFactory = records[ENS_TEXT_KEYS.factory];
        const restoredFactory = ensFactory && isAddress(ensFactory) ? (ensFactory as `0x${string}`) : factory;
        const restored: CollectionRecord = {
          artistENS: records[ENS_TEXT_KEYS.creator] || pkg.manifest.artistENS,
          collectionENS: collectionEns,
          manifest: {
            ...pkg.manifest,
            name: records[ENS_TEXT_KEYS.collection] || pkg.manifest.name,
          },
          algorithmHash: ensAlgorithmHash as `0x${string}`,
          codeURI,
          factory: restoredFactory,
          contract: projectContract,
          mintPriceWei: records[ENS_TEXT_KEYS.mintPriceWei] || "0",
          publishedAt: matchingLocal?.publishedAt || new Date().toISOString(),
        };

        saveCollection(restored);

        if (!cancelled) {
          setPublished(restored);
          setStatus("Collection already published");
        }
      } catch {
        if (!cancelled && matchingLocal) {
          setPublished(matchingLocal);
          setStatus("Collection already published");
        }
      }
    }

    void restorePublishedState();

    return () => {
      cancelled = true;
    };
  }, [collectionEns, factory, pkg.manifest, publicClient]);

  async function onUpload(file: File) {
    setError(null);
    setStatus("Validating ZIP package");
    try {
      const parsed = await parseArtPackage(file);
      setPkg({
        ...parsed,
        manifest: {
          ...parsed.manifest,
          artistENS: parsed.manifest.artistENS || artistRoot,
        },
      });
      setOutputs({});
      setPublished(null);
      setStatus("Package validated");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function publish() {
    if (!address || !walletClient || !publicClient) {
      setError("Connect a Sepolia wallet before publishing the package contract and ENS records.");
      return;
    }

    if (!factory) {
      setError("Set NEXT_PUBLIC_ARTNAMESPACE_FACTORY before publishing package contracts.");
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const bundle = createAlgorithmBundle(pkg);

      setStatus("Checking package ERC-721 contract");
      const collectionHash = await publicClient.readContract({
        address: factory,
        abi: artNamespaceFactoryAbi,
        functionName: "hashCollectionENS",
        args: [collectionEns],
      });
      let projectContract = await publicClient.readContract({
        address: factory,
        abi: artNamespaceFactoryAbi,
        functionName: "projectForCollectionHash",
        args: [collectionHash],
      });

      let codeURI = "";
      let effectiveAlgorithmHash = bundle.packageHash;

      if (projectContract === zeroAddress) {
        setStatus("Uploading algorithm bundle to Walrus");
        const walrus = await uploadWalrusArtifact({
          filename: `${pkg.manifest.slug}-algorithm.json`,
          contentType: "application/json",
          content: JSON.stringify(bundle, null, 2),
        });
        codeURI = walrus.uri;

        setStatus("Deploying package ERC-721 contract");
        const deployTx = await walletClient.writeContract({
          account: address,
          chain: sepolia,
          address: factory,
          abi: artNamespaceFactoryAbi,
          functionName: "createProject",
          args: [
            pkg.manifest.name,
            collectionSymbol(pkg.manifest.name, pkg.manifest.slug),
            pkg.manifest.artistENS,
            collectionEns,
            codeURI,
            bundle.packageHash,
            BigInt(pkg.manifest.maxSupply),
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash: deployTx });

        projectContract = await publicClient.readContract({
          address: factory,
          abi: artNamespaceFactoryAbi,
          functionName: "projectForCollectionHash",
          args: [collectionHash],
        });

        if (projectContract === zeroAddress) {
          throw new Error("Factory did not return a project contract for this package.");
        }
      } else {
        setStatus("Reusing existing package ERC-721 contract");
        const [existingCodeURI, existingAlgorithmHash] = await Promise.all([
          publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "algorithmURI",
          }),
          publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "algorithmHash",
          }),
        ]);
        codeURI = existingCodeURI;
        effectiveAlgorithmHash = existingAlgorithmHash;
      }

      const record: CollectionRecord = {
        artistENS: pkg.manifest.artistENS,
        collectionENS: collectionEns,
        manifest: pkg.manifest,
        algorithmHash: effectiveAlgorithmHash,
        codeURI,
        factory,
        contract: projectContract,
        mintPriceWei: "0",
        publishedAt: new Date().toISOString(),
      };

      setStatus(`Writing ENS text records for ${collectionEns}`);
      await writeEnsTextRecords({
        publicClient,
        walletClient,
        account: address,
        name: collectionEns,
        records: {
          [ENS_TEXT_KEYS.creator]: pkg.manifest.artistENS,
          [ENS_TEXT_KEYS.collection]: pkg.manifest.name,
          [ENS_TEXT_KEYS.algorithmHash]: effectiveAlgorithmHash,
          [ENS_TEXT_KEYS.codeURI]: codeURI,
          [ENS_TEXT_KEYS.factory]: factory,
          [ENS_TEXT_KEYS.projectContract]: projectContract,
          [ENS_TEXT_KEYS.contract]: projectContract,
          [ENS_TEXT_KEYS.mintPriceWei]: "0",
          [ENS_TEXT_KEYS.maxSupply]: String(pkg.manifest.maxSupply),
          [ENS_TEXT_KEYS.chain]: "sepolia",
        },
      });

      saveCollection(record);
      setPublished(record);
      setStatus("Collection published");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <StatusPill tone="good">Artist Flow</StatusPill>
          <h1 className="mt-4 font-serif text-5xl">Create Curvefields</h1>
          <p className="mt-3 max-w-2xl leading-7 text-neutral-700">
            Upload a deterministic p5.js package, preview seeded outputs, store the algorithm on Walrus, and write collection records to ENS.
          </p>
        </div>
        <div className="font-mono text-xs text-neutral-600">
          <div>Artist: {pkg.manifest.artistENS}</div>
          <div>Collection: {collectionEns}</div>
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <div className="border border-line p-4">
            <label className="mb-3 block text-sm font-medium">Algorithm package</label>
            <input
              className="block w-full border border-line p-2 text-sm"
              type="file"
              accept=".zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onUpload(file);
              }}
            />
            <button
              className="mt-3 inline-flex items-center gap-2 border border-line px-3 py-2 text-sm hover:border-ink"
              onClick={() => {
                setPkg(samplePackage(artistRoot));
                setOutputs({});
                setPublished(null);
                setStatus("Sample package loaded");
              }}
            >
              <Wand2 size={16} /> Use Sample
            </button>
          </div>

          <div className="border border-line p-4">
            <h2 className="font-serif text-2xl">{pkg.manifest.name}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{pkg.manifest.description}</p>
            <dl className="mt-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between gap-3">
                <dt>Package</dt>
                <dd>{pkg.sourceName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Hash</dt>
                <dd>{truncateMiddle(algorithmHash, 14)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Max supply</dt>
                <dd>{pkg.manifest.maxSupply}</dd>
              </div>
            </dl>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 bg-ink px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={publishing || Boolean(published)}
            onClick={() => void publish()}
          >
            {publishing ? <Loader2 className="animate-spin" size={16} /> : published ? <Check size={16} /> : <FileUp size={16} />}
            {published ? "Published" : "Publish to Walrus + ENS"}
          </button>

          <div className="min-h-12 text-sm">
            <p className="text-neutral-700">{status}</p>
            {error ? <p className="mt-2 text-red-700">{error}</p> : null}
          </div>
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-3xl">Deterministic Previews</h2>
            <span className="font-mono text-xs text-neutral-600">{Object.keys(outputs).length}/6 rendered</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {seeds.map((seed, index) => (
              <div key={seed}>
                <RenderFrame
                  artistENS={pkg.manifest.artistENS}
                  artworkENS={`${String(index + 1).padStart(3, "0")}.${collectionEns}`}
                  collectionENS={collectionEns}
                  compact
                  onRendered={(output) => setOutputs((current) => ({ ...current, [seed]: output }))}
                  params={generateParams(pkg.paramsSchema, seed)}
                  seed={seed}
                  sketch={pkg.sketch}
                  tokenId={index + 1}
                />
                <p className="mt-2 font-mono text-xs text-neutral-600">{truncateMiddle(seed, 12)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {published ? (
        <section className="mt-10 border-t border-line pt-8">
          <div className="mb-4 flex items-center gap-2 text-teal-800">
            <Check size={18} />
            <h2 className="font-serif text-3xl">Published</h2>
          </div>
          <RecordTable
            records={{
              [ENS_TEXT_KEYS.creator]: published.artistENS,
              [ENS_TEXT_KEYS.collection]: published.manifest.name,
              [ENS_TEXT_KEYS.algorithmHash]: published.algorithmHash,
              [ENS_TEXT_KEYS.codeURI]: published.codeURI,
              [ENS_TEXT_KEYS.factory]: published.factory,
              [ENS_TEXT_KEYS.projectContract]: published.contract,
              [ENS_TEXT_KEYS.contract]: published.contract,
              [ENS_TEXT_KEYS.mintPriceWei]: published.mintPriceWei,
            }}
          />
          <Link className="mt-5 inline-flex border border-ink px-4 py-2 text-sm hover:bg-paper" href={`/collection/${published.collectionENS}`}>
            Open mint page
          </Link>
        </section>
      ) : null}
    </main>
  );
}
