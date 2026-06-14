"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Loader2, Sparkles, Tag } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatEther } from "viem";
import { RenderFrame } from "@/components/render-frame";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { createSeed, createUniquenessHash, dataUrlToBase64, generateParams, hashJson } from "@/lib/art/deterministic";
import { createAlgorithmBundle, samplePackage } from "@/lib/art/sample";
import type { AlgorithmBundle, CollectionRecord, GeneratedOutput, ProvenanceManifest } from "@/lib/art/types";
import { artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import {
  DEFAULT_COLLECTION_SLUG,
  ENS_TEXT_KEYS,
  SEPOLIA_CHAIN_ID,
  getArtworkEns,
} from "@/lib/constants";
import { writeEnsTextRecords } from "@/lib/ens";
import { truncateMiddle } from "@/lib/format";
import { loadCollection, saveArtwork } from "@/lib/local-cache";
import { formatMintPrice, parseMintPriceEth } from "@/lib/price";
import { resolveProjectContract } from "@/lib/project";
import { uploadWalrusArtifact, walrusProxyUrl } from "@/lib/walrus";

export function CollectionMint({ collectionENS }: { collectionENS: string }) {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const [bundle, setBundle] = useState<AlgorithmBundle>(() => createAlgorithmBundle(samplePackage()));
  const [record, setRecord] = useState<CollectionRecord | null>(null);
  const [ensRecords, setEnsRecords] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState("Ready to mint a deterministic output");
  const [error, setError] = useState<string | null>(null);
  const [previewTokenId, setPreviewTokenId] = useState(1);
  const [projectContract, setProjectContract] = useState<`0x${string}` | undefined>();
  const [projectOwner, setProjectOwner] = useState<`0x${string}` | undefined>();
  const [mintPriceWei, setMintPriceWei] = useState<bigint>(0n);
  const [priceInputEth, setPriceInputEth] = useState("0");
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const nextSeed = useMemo(() => createSeed(`${collectionENS}-${previewTokenId}`), [collectionENS, previewTokenId]);
  const params = useMemo(() => generateParams(bundle.paramsSchema, nextSeed), [bundle.paramsSchema, nextSeed]);
  const nextTokenId = previewTokenId;
  const artworkENS = getArtworkEns(nextTokenId, collectionENS);
  const isProjectOwner = Boolean(
    address && projectOwner && address.toLowerCase() === projectOwner.toLowerCase(),
  );

  useEffect(() => {
    async function loadEns() {
      await Promise.resolve();
      const local = loadCollection();
      if (local?.collectionENS === collectionENS) {
        setRecord(local);
      }

      try {
        const { readEnsTextRecords } = await import("@/lib/ens");
        const records = await readEnsTextRecords({
          name: collectionENS,
          keys: [
            ENS_TEXT_KEYS.creator,
            ENS_TEXT_KEYS.collection,
            ENS_TEXT_KEYS.algorithmHash,
            ENS_TEXT_KEYS.codeURI,
            ENS_TEXT_KEYS.factory,
            ENS_TEXT_KEYS.projectContract,
            ENS_TEXT_KEYS.contract,
            ENS_TEXT_KEYS.mintPriceWei,
            ENS_TEXT_KEYS.maxSupply,
          ],
        });
        setEnsRecords(records);
        const resolvedContract = resolveProjectContract(records, local);
        setProjectContract(resolvedContract);
        if (!resolvedContract) {
          setStatus("No package ERC-721 contract found in ENS records yet");
        }
        const codeURI = records[ENS_TEXT_KEYS.codeURI] || local?.codeURI;
        if (codeURI) {
          const response = await fetch(walrusProxyUrl(codeURI));
          if (response.ok) {
            setBundle((await response.json()) as AlgorithmBundle);
          }
        }
      } catch {
        setProjectContract(resolveProjectContract({}, local));
        setStatus("Using local sample while ENS/Walrus records are unavailable");
      }
    }

    void loadEns();
  }, [collectionENS]);

  useEffect(() => {
    async function loadProjectContract() {
      await Promise.resolve();
      if (!projectContract || !publicClient) return;

      try {
        const [tokenId, price, owner] = await Promise.all([
          publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "nextTokenId",
          }),
          publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "mintPriceWei",
          }),
          publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "owner",
          }),
        ]);
        setPreviewTokenId(Number(tokenId));
        setMintPriceWei(price);
        setPriceInputEth(formatEther(price));
        setProjectOwner(owner);
      } catch {
        setStatus("Package contract was found, but it is not reachable on Sepolia yet");
      }
    }

    void loadProjectContract();
  }, [projectContract, publicClient]);

  async function updateMintPrice() {
    if (!projectContract || !address || !walletClient || !publicClient) {
      setError("Connect the artist wallet and load a package contract before updating price.");
      return;
    }

    setUpdatingPrice(true);
    setError(null);

    try {
      const nextPrice = parseMintPriceEth(priceInputEth);
      setStatus("Updating package mint price");
      const tx = await walletClient.writeContract({
        account: address,
        chain: sepolia,
        address: projectContract,
        abi: artNamespaceProjectAbi,
        functionName: "setMintPrice",
        args: [nextPrice],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setMintPriceWei(nextPrice);

      setStatus("Writing price record to ENS");
      await writeEnsTextRecords({
        publicClient,
        walletClient,
        account: address,
        name: collectionENS,
        records: {
          [ENS_TEXT_KEYS.mintPriceWei]: nextPrice.toString(),
        },
      });
      setEnsRecords((current) => ({
        ...current,
        [ENS_TEXT_KEYS.mintPriceWei]: nextPrice.toString(),
      }));
      setStatus("Mint price updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingPrice(false);
    }
  }

  async function mint() {
    if (!output) {
      setError("The render is still preparing. Try again in a moment.");
      return;
    }

    if (!address || !walletClient || !publicClient) {
      setError("Connect a Sepolia wallet before minting.");
      return;
    }

    if (!projectContract) {
      setError("No package ERC-721 contract found for this collection. Publish the package contract first.");
      return;
    }

    setMinting(true);
    setError(null);

    try {
      setStatus("Reading package mint state");
      const [onchainTokenId, onchainPrice] = await Promise.all([
        publicClient.readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "nextTokenId",
        }),
        publicClient.readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "mintPriceWei",
        }),
      ]);
      const tokenId = Number(onchainTokenId);
      if (tokenId !== previewTokenId) {
        throw new Error("The next token ID changed. Refresh the collection page and render the latest output.");
      }
      setMintPriceWei(onchainPrice);

      const finalArtworkENS = getArtworkEns(tokenId, collectionENS);
      const algorithmHash = record?.algorithmHash || bundle.packageHash;
      const paramsHash = hashJson(output.params);
      const uniquenessHash = createUniquenessHash({
        artistENS: bundle.manifest.artistENS,
        collectionSlug: DEFAULT_COLLECTION_SLUG,
        algorithmHash,
        seed: output.seed,
        paramsHash,
      });

      setStatus("Uploading params to Walrus");
      const paramsUpload = await uploadWalrusArtifact({
        filename: `${finalArtworkENS}-params.json`,
        contentType: "application/json",
        content: JSON.stringify(output.params, null, 2),
      });

      const render = dataUrlToBase64(output.dataUrl);
      setStatus("Uploading render to Walrus");
      const renderUpload = await uploadWalrusArtifact({
        filename: `${finalArtworkENS}.png`,
        contentType: render.contentType,
        content: render.base64,
        encoding: "base64",
      });

      const metadata = {
        name: finalArtworkENS,
        description: `Deterministic output from ${collectionENS}`,
        image: renderUpload.uri,
        external_url: `/art/${finalArtworkENS}`,
        attributes: Object.entries(output.features).map(([trait_type, value]) => ({ trait_type, value })),
        properties: {
          seed: output.seed,
          params: output.params,
          algorithmHash,
        },
      };

      setStatus("Uploading NFT metadata to Walrus");
      const metadataUpload = await uploadWalrusArtifact({
        filename: `${finalArtworkENS}-metadata.json`,
        contentType: "application/json",
        content: JSON.stringify(metadata, null, 2),
      });

      const manifest: ProvenanceManifest = {
        version: "1.0",
        artistENS: bundle.manifest.artistENS,
        collectionENS,
        artworkENS: finalArtworkENS,
        tokenId,
        chainId: SEPOLIA_CHAIN_ID,
        contract: projectContract,
        algorithmURI: record?.codeURI || "",
        algorithmHash,
        renderer: "p5js",
        rendererVersion: bundle.manifest.rendererVersion,
        seed: output.seed,
        paramsURI: paramsUpload.uri,
        paramsHash,
        renderURI: renderUpload.uri,
        metadataURI: metadataUpload.uri,
        features: output.features,
        createdAt: new Date().toISOString(),
      };

      setStatus("Uploading provenance manifest to Walrus");
      const manifestUpload = await uploadWalrusArtifact({
        filename: `${finalArtworkENS}-provenance.json`,
        contentType: "application/json",
        content: JSON.stringify(manifest, null, 2),
      });

      setStatus("Minting from package ERC-721");
      const tx = await walletClient.writeContract({
        account: address,
        chain: sepolia,
        address: projectContract,
        abi: artNamespaceProjectAbi,
        functionName: "mintArtwork",
        args: [address, finalArtworkENS, metadataUpload.uri, uniquenessHash],
        value: onchainPrice,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      saveArtwork({ ...manifest, artworkENS: finalArtworkENS });
      setPreviewTokenId(tokenId + 1);

      try {
        setStatus(`Writing ENS records for ${finalArtworkENS}`);
        await writeEnsTextRecords({
          publicClient,
          walletClient,
          account: address,
          name: finalArtworkENS,
          records: {
            [ENS_TEXT_KEYS.tokenId]: String(tokenId),
            [ENS_TEXT_KEYS.seed]: output.seed,
            [ENS_TEXT_KEYS.paramsHash]: paramsHash,
            [ENS_TEXT_KEYS.metadataURI]: metadataUpload.uri,
            [ENS_TEXT_KEYS.renderURI]: renderUpload.uri,
            [ENS_TEXT_KEYS.algorithmHash]: algorithmHash,
            [ENS_TEXT_KEYS.projectContract]: projectContract,
            [ENS_TEXT_KEYS.contract]: projectContract,
            [ENS_TEXT_KEYS.manifestURI]: manifestUpload.uri,
          },
        });

        setStatus("Mint complete");
        router.push(`/art/${finalArtworkENS}`);
      } catch {
        setStatus("Mint complete; ENS artwork records were not written");
        setError(
          `Token ${tokenId} was minted, but ENS records for ${finalArtworkENS} were not written. ` +
            "Use the wallet that owns that ENS subname to write records, or transfer the subname to this collector wallet.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMinting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 border-b border-line pb-6">
        <StatusPill tone="good">Collector Flow</StatusPill>
        <h1 className="mt-4 font-serif text-5xl">{bundle.manifest.name}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-neutral-700">{bundle.manifest.description}</p>
        <div className="mt-4 flex flex-wrap gap-3 font-mono text-xs text-neutral-600">
          <span>{collectionENS}</span>
          <span>{truncateMiddle(record?.algorithmHash || bundle.packageHash, 14)}</span>
          <span>{formatMintPrice(mintPriceWei)}</span>
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <RenderFrame
            artistENS={bundle.manifest.artistENS}
            artworkENS={artworkENS}
            collectionENS={collectionENS}
            onRendered={setOutput}
            params={params}
            seed={nextSeed}
            sketch={bundle.sketch}
            tokenId={nextTokenId}
          />
        </div>

        <aside className="space-y-5">
          <div className="border border-line p-4">
            <h2 className="font-serif text-2xl">Next output</h2>
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <div>
                <dt className="text-neutral-500">Seed</dt>
                <dd className="break-all">{nextSeed}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Artwork ENS</dt>
                <dd>{artworkENS}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Features</dt>
                <dd>{output ? Object.entries(output.features).map(([key, value]) => `${key}: ${value}`).join(" / ") : "rendering"}</dd>
              </div>
            </dl>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 bg-ink px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={minting || !output}
            onClick={() => void mint()}
          >
            {minting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Mint Unique Piece
          </button>

          <div className="min-h-12 text-sm">
            <p className="text-neutral-700">{status}</p>
            {!projectContract ? <p className="mt-2 text-amber-800">Publish this package contract before live minting.</p> : null}
            {error ? <p className="mt-2 text-red-700">{error}</p> : null}
          </div>

          {isProjectOwner ? (
            <div className="border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <Tag size={16} />
                <h2 className="font-serif text-2xl">Mint price</h2>
              </div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-500">Fixed price in ETH</label>
              <input
                className="w-full border border-line p-2 font-mono text-sm"
                inputMode="decimal"
                onChange={(event) => setPriceInputEth(event.target.value)}
                value={priceInputEth}
              />
              <button
                className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-ink px-3 py-2 text-sm hover:bg-paper disabled:cursor-not-allowed disabled:border-neutral-300"
                disabled={updatingPrice}
                onClick={() => void updateMintPrice()}
              >
                {updatingPrice ? <Loader2 className="animate-spin" size={16} /> : null}
                Update Price
              </button>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Database size={16} />
              <h2 className="font-serif text-2xl">ENS records</h2>
            </div>
            <RecordTable records={ensRecords} />
          </div>
        </aside>
      </section>
    </main>
  );
}
