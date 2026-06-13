"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Loader2, Sparkles } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { RenderFrame } from "@/components/render-frame";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { createSeed, createUniquenessHash, dataUrlToBase64, generateParams, hashJson } from "@/lib/art/deterministic";
import { createAlgorithmBundle, samplePackage } from "@/lib/art/sample";
import type { AlgorithmBundle, CollectionRecord, GeneratedOutput, ProvenanceManifest } from "@/lib/art/types";
import { artNamespaceDropAbi } from "@/lib/contracts/artnamespace-drop";
import {
  DEFAULT_COLLECTION_SLUG,
  ENS_TEXT_KEYS,
  SEPOLIA_CHAIN_ID,
  getArtworkEns,
  getDropContractAddress,
} from "@/lib/constants";
import { writeEnsTextRecords } from "@/lib/ens";
import { truncateMiddle } from "@/lib/format";
import { loadCollection, saveArtwork } from "@/lib/local-cache";
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

  const contract = getDropContractAddress();
  const nextSeed = useMemo(() => createSeed(`${collectionENS}-${previewTokenId}`), [collectionENS, previewTokenId]);
  const params = useMemo(() => generateParams(bundle.paramsSchema, nextSeed), [bundle.paramsSchema, nextSeed]);
  const nextTokenId = previewTokenId;
  const artworkENS = getArtworkEns(nextTokenId, collectionENS);

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
            ENS_TEXT_KEYS.contract,
          ],
        });
        setEnsRecords(records);
        const codeURI = records[ENS_TEXT_KEYS.codeURI] || local?.codeURI;
        if (codeURI) {
          const response = await fetch(walrusProxyUrl(codeURI));
          if (response.ok) {
            setBundle((await response.json()) as AlgorithmBundle);
          }
        }
      } catch {
        setStatus("Using local sample while ENS/Walrus records are unavailable");
      }

      if (contract && publicClient) {
        try {
          const tokenId = await publicClient.readContract({
            address: contract,
            abi: artNamespaceDropAbi,
            functionName: "nextTokenId",
          });
          setPreviewTokenId(Number(tokenId));
        } catch {
          setStatus("Using token #1 preview until the contract is reachable");
        }
      }
    }

    void loadEns();
  }, [collectionENS, contract, publicClient]);

  async function mint() {
    if (!output) {
      setError("The render is still preparing. Try again in a moment.");
      return;
    }

    if (!address || !walletClient || !publicClient) {
      setError("Connect a Sepolia wallet before minting.");
      return;
    }

    setMinting(true);
    setError(null);

    try {
      let tokenId = previewTokenId;
      if (contract) {
        setStatus("Reading next token ID");
        const onchainTokenId = Number(
          await publicClient.readContract({
            address: contract,
            abi: artNamespaceDropAbi,
            functionName: "nextTokenId",
          }),
        );
        if (onchainTokenId !== previewTokenId) {
          throw new Error("The next token ID changed. Refresh the collection page and render the latest output.");
        }
      }

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
        contract,
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

      if (contract) {
        setStatus("Minting Sepolia NFT");
        const tx = await walletClient.writeContract({
          account: address,
          chain: sepolia,
          address: contract,
          abi: artNamespaceDropAbi,
          functionName: "mintArtwork",
          args: [address, finalArtworkENS, metadataUpload.uri, uniquenessHash],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

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
          [ENS_TEXT_KEYS.contract]: contract,
          [ENS_TEXT_KEYS.manifestURI]: manifestUpload.uri,
        },
      });

      saveArtwork({ ...manifest, artworkENS: finalArtworkENS });
      setStatus("Mint complete");
      router.push(`/art/${finalArtworkENS}`);
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
          <span>Free Sepolia mint</span>
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
            {!contract ? <p className="mt-2 text-amber-800">Set NEXT_PUBLIC_DROP_CONTRACT before the live NFT mint.</p> : null}
            {error ? <p className="mt-2 text-red-700">{error}</p> : null}
          </div>

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
