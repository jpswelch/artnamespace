"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, FileUp, Loader2, Wand2 } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatEther, isAddress, zeroAddress } from "viem";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { createAlgorithmBundle, samplePackage } from "@/lib/art/sample";
import { packageHash, parseArtPackage } from "@/lib/art/package";
import type { ArtPackage, CollectionRecord } from "@/lib/art/types";
import { artNamespaceFactoryAbi, artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { ENS_TEXT_KEYS, getCollectionEns, getFactoryAddress } from "@/lib/constants";
import { readEnsTextRecords, writeEnsTextRecords } from "@/lib/ens";
import { loadCollection, saveCollection } from "@/lib/local-cache";
import { truncateMiddle } from "@/lib/format";
import { parseMintPriceEth } from "@/lib/price";
import { collectionSymbol, resolveProjectContract } from "@/lib/project";
import { useSepoliaEnsName } from "@/lib/use-sepolia-ens-name";
import { uploadWalrusArtifact } from "@/lib/walrus";

export function CreateFlow() {
  const [pkg, setPkg] = useState<ArtPackage | null>(null);
  const [status, setStatus] = useState<string>("Choose or upload an algorithm package");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<CollectionRecord | null>(null);
  const [mintPriceInputEth, setMintPriceInputEth] = useState("0");
  const { address } = useAccount();
  const { ensName, isLoading: loadingEnsName } = useSepoliaEnsName(address);
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });

  const creatorEns = ensName || "";
  const manifestForAccount = useMemo(
    () =>
      pkg
        ? {
            ...pkg.manifest,
            artistENS: creatorEns,
          }
        : null,
    [creatorEns, pkg],
  );
  const collectionEns = creatorEns && pkg ? getCollectionEns(creatorEns, pkg.manifest.slug) : "";
  const activePublished = published?.collectionENS === collectionEns ? published : null;
  const algorithmHash = pkg ? packageHash(pkg) : null;
  const factory = getFactoryAddress();
  const missingCreatorEns = Boolean(address && !loadingEnsName && !ensName);
  const creatorEnsStatus = !address
    ? "Connect a wallet to resolve the creator Sepolia ENS name."
    : loadingEnsName
      ? "Checking the connected wallet for a Sepolia ENS name."
      : ensName
        ? `Publishing under ${ensName} on Sepolia.`
        : "No Sepolia ENS name was found for this wallet. Register or configure a Sepolia ENS name before creating a collection.";
  const canPublish = Boolean(pkg && address && ensName && !loadingEnsName && !publishing && !activePublished);

  useEffect(() => {
    let cancelled = false;

    async function restorePublishedState() {
      const accountManifest = manifestForAccount;
      if (!collectionEns || !accountManifest) return;

      const local = loadCollection();
      const matchingLocal = local?.collectionENS === collectionEns ? local : null;

      if (matchingLocal?.contract) {
        if (!cancelled) {
          setPublished(matchingLocal);
          setMintPriceInputEth(formatEther(BigInt(matchingLocal.mintPriceWei || "0")));
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
          artistENS: records[ENS_TEXT_KEYS.creator] || accountManifest.artistENS,
          collectionENS: collectionEns,
          manifest: {
            ...accountManifest,
            name: records[ENS_TEXT_KEYS.collection] || accountManifest.name,
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
          setMintPriceInputEth(formatEther(BigInt(restored.mintPriceWei || "0")));
          setStatus("Collection already published");
        }
      } catch {
        if (!cancelled && matchingLocal) {
          setPublished(matchingLocal);
          setMintPriceInputEth(formatEther(BigInt(matchingLocal.mintPriceWei || "0")));
          setStatus("Collection already published");
        }
      }
    }

    void restorePublishedState();

    return () => {
      cancelled = true;
    };
  }, [collectionEns, factory, manifestForAccount, publicClient]);

  async function onUpload(file: File) {
    setError(null);
    setStatus("Validating ZIP package");
    try {
      const parsed = await parseArtPackage(file);
      setPkg({
        ...parsed,
        manifest: {
          ...parsed.manifest,
          artistENS: "",
        },
      });
      setMintPriceInputEth("0");
      setPublished(null);
      setStatus("Package validated");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function publish() {
    if (!pkg) {
      setError("Choose or upload an algorithm package before publishing.");
      return;
    }

    if (!address || !walletClient || !publicClient) {
      setError("Connect a Sepolia wallet before publishing the package contract and ENS records.");
      return;
    }

    if (loadingEnsName) {
      setError("Still checking the connected wallet for a Sepolia ENS name. Try again in a moment.");
      return;
    }

    if (!ensName) {
      setError("This creator wallet needs a Sepolia ENS name before publishing. Register or configure a Sepolia ENS name for this wallet, then reconnect and try again.");
      return;
    }

    if (!factory) {
      setError("Set NEXT_PUBLIC_ARTNAMESPACE_FACTORY before publishing package contracts.");
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const targetCollectionEns = getCollectionEns(ensName, pkg.manifest.slug);
      const packageForPublish: ArtPackage = {
        ...pkg,
        manifest: {
          ...pkg.manifest,
          artistENS: ensName,
        },
      };
      const bundle = createAlgorithmBundle(packageForPublish);
      const initialMintPriceWei = parseMintPriceEth(mintPriceInputEth);

      setStatus("Checking package ERC-721 contract");
      const collectionHash = await publicClient.readContract({
        address: factory,
        abi: artNamespaceFactoryAbi,
        functionName: "hashCollectionENS",
        args: [targetCollectionEns],
      });
      let projectContract = await publicClient.readContract({
        address: factory,
        abi: artNamespaceFactoryAbi,
        functionName: "projectForCollectionHash",
        args: [collectionHash],
      });

      let codeURI = "";
      let effectiveAlgorithmHash = bundle.packageHash;
      let effectiveMintPriceWei = initialMintPriceWei;

      if (projectContract === zeroAddress) {
        setStatus("Checking factory compatibility");
        try {
          await publicClient.simulateContract({
            account: address,
            address: factory,
            abi: artNamespaceFactoryAbi,
            functionName: "createProject",
            args: [
              packageForPublish.manifest.name,
              collectionSymbol(packageForPublish.manifest.name, packageForPublish.manifest.slug),
              ensName,
              targetCollectionEns,
              "walrus://preflight",
              bundle.packageHash,
              BigInt(packageForPublish.manifest.maxSupply),
              initialMintPriceWei,
            ],
          });
        } catch {
          throw new Error(
            "The configured ArtNamespace factory does not support publish-time mint prices. Redeploy the latest factory contract, then update NEXT_PUBLIC_ARTNAMESPACE_FACTORY.",
          );
        }

        setStatus("Uploading algorithm bundle to Walrus");
        const walrus = await uploadWalrusArtifact({
          filename: `${packageForPublish.manifest.slug}-algorithm.json`,
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
            packageForPublish.manifest.name,
            collectionSymbol(packageForPublish.manifest.name, packageForPublish.manifest.slug),
            ensName,
            targetCollectionEns,
            codeURI,
            bundle.packageHash,
            BigInt(packageForPublish.manifest.maxSupply),
            initialMintPriceWei,
          ],
        });
        const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployTx });
        if (deployReceipt.status !== "success") {
          throw new Error("The package ERC-721 deployment transaction reverted. Check that NEXT_PUBLIC_ARTNAMESPACE_FACTORY points to the latest factory deployment.");
        }

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
        const [existingCodeURI, existingAlgorithmHash, existingMintPriceWei] = await Promise.all([
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
          publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "mintPriceWei",
          }),
        ]);
        codeURI = existingCodeURI;
        effectiveAlgorithmHash = existingAlgorithmHash;
        effectiveMintPriceWei = existingMintPriceWei;
        setMintPriceInputEth(formatEther(existingMintPriceWei));
      }

      const record: CollectionRecord = {
        artistENS: ensName,
        collectionENS: targetCollectionEns,
        manifest: packageForPublish.manifest,
        algorithmHash: effectiveAlgorithmHash,
        codeURI,
        factory,
        contract: projectContract,
        mintPriceWei: effectiveMintPriceWei.toString(),
        publishedAt: new Date().toISOString(),
      };

      setStatus(`Writing ENS text records for ${targetCollectionEns}`);
      await writeEnsTextRecords({
        publicClient,
        walletClient,
        account: address,
        name: targetCollectionEns,
        records: {
          [ENS_TEXT_KEYS.creator]: ensName,
          [ENS_TEXT_KEYS.collection]: packageForPublish.manifest.name,
          [ENS_TEXT_KEYS.algorithmHash]: effectiveAlgorithmHash,
          [ENS_TEXT_KEYS.codeURI]: codeURI,
          [ENS_TEXT_KEYS.factory]: factory,
          [ENS_TEXT_KEYS.projectContract]: projectContract,
          [ENS_TEXT_KEYS.contract]: projectContract,
          [ENS_TEXT_KEYS.mintPriceWei]: effectiveMintPriceWei.toString(),
          [ENS_TEXT_KEYS.maxSupply]: String(packageForPublish.manifest.maxSupply),
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
          <h1 className="mt-4 font-serif text-5xl">Create Collection</h1>
          <p className="mt-3 max-w-2xl leading-7 text-neutral-700">
            Upload a deterministic p5.js package, store the algorithm on Walrus, deploy the package ERC-721, and write collection records to ENS.
          </p>
        </div>
        <div className="font-mono text-xs text-neutral-600">
          <div>Artist: {creatorEns || "unresolved"}</div>
          <div>Collection: {collectionEns || "unresolved"}</div>
        </div>
      </div>

      <section className="max-w-xl space-y-5">
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
                setPkg(samplePackage(ensName || ""));
                setMintPriceInputEth("0");
                setPublished(null);
                setStatus("Sample package loaded");
              }}
            >
              <Wand2 size={16} /> Load Sample Package
            </button>
          </div>

          <div className="border border-line p-4">
            {pkg ? (
              <>
                <h2 className="font-serif text-2xl">{pkg.manifest.name}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">{pkg.manifest.description}</p>
              </>
            ) : (
              <>
                <h2 className="font-serif text-2xl">New Collection</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">No algorithm package selected.</p>
              </>
            )}
            <label className="mt-4 block text-xs uppercase tracking-wide text-neutral-500">Creator Sepolia ENS</label>
            <input
              className="mt-2 w-full border border-line p-2 font-mono text-sm disabled:bg-neutral-100"
              disabled
              placeholder={address ? "No Sepolia ENS found for connected wallet" : "Connect wallet to resolve Sepolia ENS"}
              value={creatorEns}
            />
            <p className={`mt-2 text-xs leading-5 ${missingCreatorEns ? "text-red-700" : "text-neutral-600"}`}>
              {creatorEnsStatus}
              {missingCreatorEns ? (
                <>
                  {" "}
                  <a className="underline underline-offset-2 hover:text-ink" href="https://sepolia.app.ens.domains" rel="noreferrer" target="_blank">
                    Open Sepolia ENS app
                  </a>
                </>
              ) : null}
            </p>
            <label className="mt-4 block text-xs uppercase tracking-wide text-neutral-500">Fixed mint price in ETH</label>
            <input
              className="mt-2 w-full border border-line p-2 font-mono text-sm disabled:bg-neutral-100"
              disabled={Boolean(activePublished)}
              inputMode="decimal"
              onChange={(event) => {
                setMintPriceInputEth(event.target.value);
                setPublished(null);
              }}
              value={mintPriceInputEth}
            />
            <dl className="mt-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between gap-3">
                <dt>Package</dt>
                <dd>{pkg?.sourceName || "none selected"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Hash</dt>
                <dd>{algorithmHash ? truncateMiddle(algorithmHash, 14) : "unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Max supply</dt>
                <dd>{pkg?.manifest.maxSupply || "unavailable"}</dd>
              </div>
            </dl>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 bg-ink px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={!canPublish}
            onClick={() => void publish()}
          >
            {publishing ? <Loader2 className="animate-spin" size={16} /> : activePublished ? <Check size={16} /> : <FileUp size={16} />}
            {activePublished ? "Published" : "Publish to Walrus + ENS"}
          </button>

          <div className="min-h-12 text-sm">
            <p className="text-neutral-700">{status}</p>
            {error ? <p className="mt-2 text-red-700">{error}</p> : null}
          </div>
      </section>

      {activePublished ? (
        <section className="mt-10 border-t border-line pt-8">
          <div className="mb-4 flex items-center gap-2 text-teal-800">
            <Check size={18} />
            <h2 className="font-serif text-3xl">Published</h2>
          </div>
          <RecordTable
            records={{
              [ENS_TEXT_KEYS.creator]: activePublished.artistENS,
              [ENS_TEXT_KEYS.collection]: activePublished.manifest.name,
              [ENS_TEXT_KEYS.algorithmHash]: activePublished.algorithmHash,
              [ENS_TEXT_KEYS.codeURI]: activePublished.codeURI,
              [ENS_TEXT_KEYS.factory]: activePublished.factory,
              [ENS_TEXT_KEYS.projectContract]: activePublished.contract,
              [ENS_TEXT_KEYS.contract]: activePublished.contract,
              [ENS_TEXT_KEYS.mintPriceWei]: activePublished.mintPriceWei,
            }}
          />
          <Link className="mt-5 inline-flex border border-ink px-4 py-2 text-sm hover:bg-paper" href={`/collection/${activePublished.collectionENS}`}>
            Open mint page
          </Link>
        </section>
      ) : null}
    </main>
  );
}
