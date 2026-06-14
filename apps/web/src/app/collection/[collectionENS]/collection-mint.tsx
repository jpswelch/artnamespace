"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, EyeOff, Loader2, Sparkles } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { isAddress, zeroAddress } from "viem";
import { namehash, normalize } from "viem/ens";
import { RenderFrame } from "@/components/render-frame";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { createSeed, createUniquenessHash, dataUrlToBase64, generateParams, hashJson } from "@/lib/art/deterministic";
import { createAlgorithmBundle, samplePackage } from "@/lib/art/sample";
import type { AlgorithmBundle, CollectionRecord, GeneratedOutput, ProvenanceManifest } from "@/lib/art/types";
import { artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { ENS_TEXT_KEYS, SEPOLIA_CHAIN_ID, getArtworkEns } from "@/lib/constants";
import { SEPOLIA_NAME_WRAPPER, ensureNameWrapperApproval, isSepoliaNameWrapper } from "@/lib/ens-name-wrapper";
import { getResolverForName, writeEnsTextRecords } from "@/lib/ens";
import { truncateMiddle } from "@/lib/format";
import { loadCollection, saveArtwork } from "@/lib/local-cache";
import { formatMintPrice } from "@/lib/price";
import { resolveProjectContract } from "@/lib/project";
import { uploadWalrusArtifact, walrusProxyUrl } from "@/lib/walrus";

function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function normalizeOptionalAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return isAddress(trimmed) ? (trimmed as `0x${string}`) : undefined;
}

export function CollectionMint({ collectionENS }: { collectionENS: string }) {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const [bundle, setBundle] = useState<AlgorithmBundle>(() => createAlgorithmBundle(samplePackage()));
  const [record, setRecord] = useState<CollectionRecord | null>(null);
  const [ensRecords, setEnsRecords] = useState<Record<string, string>>({});
  const [renderedOutput, setRenderedOutput] = useState<{ key: string; output: GeneratedOutput } | null>(null);
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState("Ready to mint a deterministic output");
  const [error, setError] = useState<string | null>(null);
  const [previewTokenId, setPreviewTokenId] = useState(1);
  const [contractNextArtworkENS, setContractNextArtworkENS] = useState<string | null>(null);
  const [projectContract, setProjectContract] = useState<`0x${string}` | undefined>();
  const [projectOwner, setProjectOwner] = useState<`0x${string}` | undefined>();
  const [mintPriceWei, setMintPriceWei] = useState<bigint>(0n);
  const [ensSubnameRegistrar, setEnsSubnameRegistrar] = useState<`0x${string}` | undefined>();
  const [ensRegistrarInput, setEnsRegistrarInput] = useState("");
  const [ensResolverInput, setEnsResolverInput] = useState("");
  const [configuringEns, setConfiguringEns] = useState(false);
  const [ensConfigError, setEnsConfigError] = useState<string | null>(null);

  const nextSeed = useMemo(() => createSeed(`${collectionENS}-${previewTokenId}`), [collectionENS, previewTokenId]);
  const params = useMemo(() => generateParams(bundle.paramsSchema, nextSeed), [bundle.paramsSchema, nextSeed]);
  const nextTokenId = previewTokenId;
  const artworkENS = contractNextArtworkENS || getArtworkEns(nextTokenId, collectionENS);
  const renderKey = `${artworkENS}-${nextSeed}-${bundle.packageHash}`;
  const output = renderedOutput?.key === renderKey ? renderedOutput.output : null;
  const ensRegistrarAddress = normalizeOptionalAddress(ensRegistrarInput);
  const ensResolverAddress = normalizeOptionalAddress(ensResolverInput);
  const invalidEnsRegistrar = Boolean(ensRegistrarInput.trim() && !ensRegistrarAddress);
  const invalidEnsResolver = Boolean(ensResolverInput.trim() && !ensResolverAddress);
  const isProjectOwner = sameAddress(projectOwner, address);

  const handleRendered = useCallback(
    (generatedOutput: GeneratedOutput) => {
      setRenderedOutput({ key: renderKey, output: generatedOutput });
    },
    [renderKey],
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
        const [nextArtwork, registrar, configuredResolver] = await Promise.all([
          publicClient
            .readContract({
              address: projectContract,
              abi: artNamespaceProjectAbi,
              functionName: "nextArtworkENS",
            })
            .catch(() => getArtworkEns(Number(tokenId), collectionENS)),
          publicClient
            .readContract({
              address: projectContract,
              abi: artNamespaceProjectAbi,
              functionName: "ensSubnameRegistrar",
            })
            .catch(() => zeroAddress),
          publicClient
            .readContract({
              address: projectContract,
              abi: artNamespaceProjectAbi,
              functionName: "ensResolver",
            })
            .catch(() => zeroAddress),
        ]);
        const collectionResolver =
          configuredResolver === zeroAddress ? await getResolverForName(publicClient, collectionENS).catch(() => null) : configuredResolver;

        setPreviewTokenId(Number(tokenId));
        setContractNextArtworkENS(nextArtwork);
        setMintPriceWei(price);
        setProjectOwner(owner);
        setEnsSubnameRegistrar(registrar === zeroAddress ? undefined : registrar);
        setEnsRegistrarInput(registrar === zeroAddress ? SEPOLIA_NAME_WRAPPER : registrar);
        setEnsResolverInput(collectionResolver || "");
      } catch {
        setStatus("Package contract was found, but it is not reachable on Sepolia yet");
      }
    }

    void loadProjectContract();
  }, [collectionENS, projectContract, publicClient]);

  async function configureEnsSubnames() {
    if (!address || !walletClient || !publicClient || !projectContract) {
      setEnsConfigError("Connect the package owner wallet before configuring ENS subname creation.");
      return;
    }

    if (!isProjectOwner) {
      setEnsConfigError("Only the package contract owner can configure ENS subname creation.");
      return;
    }

    const registrar = normalizeOptionalAddress(ensRegistrarInput) || SEPOLIA_NAME_WRAPPER;
    if (!registrar) {
      setEnsConfigError("Enter the collection subregistry or registrar address from ENS.");
      return;
    }

    const resolver = normalizeOptionalAddress(ensResolverInput) || (await getResolverForName(publicClient, collectionENS).catch(() => null));
    if (!resolver) {
      setEnsConfigError("Enter an artwork resolver address, or configure a resolver on the collection ENS name first.");
      return;
    }

    setConfiguringEns(true);
    setEnsConfigError(null);

    try {
      if (isSepoliaNameWrapper(registrar)) {
        setStatus("Approving package contract to create ENS artwork subnames");
        await ensureNameWrapperApproval({
          publicClient,
          walletClient,
          account: address,
          operator: projectContract,
        });
      }

      setStatus("Configuring ENS artwork subname creation");
      const parentNode = namehash(normalize(collectionENS));
      const tx = await walletClient.writeContract({
        account: address,
        chain: sepolia,
        address: projectContract,
        abi: artNamespaceProjectAbi,
        functionName: "configureEnsSubnames",
        args: [registrar, parentNode, resolver, 0n, 0, 0n],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== "success") {
        throw new Error("The ENS subname configuration transaction reverted.");
      }

      setEnsSubnameRegistrar(registrar);
      setEnsRegistrarInput(registrar);
      setEnsResolverInput(resolver);
      setEnsRecords((current) => ({
        ...current,
        [ENS_TEXT_KEYS.subnameRegistrar]: registrar,
        [ENS_TEXT_KEYS.subnameParentNode]: parentNode,
        [ENS_TEXT_KEYS.artworkResolver]: resolver,
      }));
      setStatus("ENS artwork subname creation configured");

      try {
        await writeEnsTextRecords({
          publicClient,
          walletClient,
          account: address,
          name: collectionENS,
          records: {
            [ENS_TEXT_KEYS.subnameRegistrar]: registrar,
            [ENS_TEXT_KEYS.subnameParentNode]: parentNode,
            [ENS_TEXT_KEYS.artworkResolver]: resolver,
          },
        });
      } catch {
        setStatus("ENS subname creation configured on the contract; collection text records were not updated");
      }
    } catch (err) {
      setEnsConfigError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfiguringEns(false);
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

      const finalArtworkENS = await publicClient
        .readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "nextArtworkENS",
        })
        .catch(() => getArtworkEns(tokenId, collectionENS));
      const algorithmHash = record?.algorithmHash || bundle.packageHash;
      const paramsHash = hashJson(output.params);
      const uniquenessHash = createUniquenessHash({
        artistENS: bundle.manifest.artistENS,
        collectionSlug: bundle.manifest.slug,
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
        args: [address, metadataUpload.uri, uniquenessHash],
        value: onchainPrice,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      saveArtwork({ ...manifest, artworkENS: finalArtworkENS });
      const nextArtworkAfterMint = await publicClient
        .readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "nextArtworkENS",
        })
        .catch(() => getArtworkEns(tokenId + 1, collectionENS));
      setPreviewTokenId(tokenId + 1);
      setContractNextArtworkENS(nextArtworkAfterMint);

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
        <div className="relative min-h-[min(80vw,520px)] overflow-hidden border border-line bg-white">
          <div className="absolute -left-[9999px] top-0 h-[520px] w-[520px] opacity-0 pointer-events-none" aria-hidden="true">
            <RenderFrame
              artistENS={bundle.manifest.artistENS}
              artworkENS={artworkENS}
              collectionENS={collectionENS}
              onRendered={handleRendered}
              params={params}
              seed={nextSeed}
              sketch={bundle.sketch}
              tokenId={nextTokenId}
            />
          </div>
          <div className="grid min-h-[min(80vw,520px)] place-items-center p-8 text-center">
            <div>
              <EyeOff className="mx-auto mb-4 text-neutral-500" size={32} />
              <h2 className="font-serif text-3xl">Reveal after mint</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-neutral-700">
                The next generative output is prepared privately and revealed only after the mint completes.
              </p>
              <p className="mt-5 font-mono text-xs text-neutral-500">{output ? "Reveal ready" : "Preparing reveal"}</p>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-line p-4">
            <h2 className="font-serif text-2xl">Mint details</h2>
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <div>
                <dt className="text-neutral-500">Artwork ENS</dt>
                <dd>{artworkENS}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Seed</dt>
                <dd>Hidden until minted</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Features</dt>
                <dd>Hidden until minted</dd>
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
            {projectContract && !ensSubnameRegistrar ? (
              <p className="mt-2 text-amber-800">
                ENS artwork subname creation is not configured yet. The package owner can configure the Sepolia ENS Name Wrapper below.
              </p>
            ) : null}
            {error ? <p className="mt-2 text-red-700">{error}</p> : null}
          </div>

          {projectContract && !ensSubnameRegistrar ? (
            <div className="border border-line p-4">
              <h2 className="font-serif text-2xl">ENS subnames</h2>
              {isProjectOwner ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-xs uppercase tracking-wide text-neutral-500">ENS registrar</label>
                  <input
                    className="w-full border border-line p-2 font-mono text-xs"
                    onChange={(event) => {
                      setEnsRegistrarInput(event.target.value);
                      setEnsConfigError(null);
                    }}
                    placeholder={`Defaults to ${SEPOLIA_NAME_WRAPPER}`}
                    value={ensRegistrarInput}
                  />
                  {invalidEnsRegistrar ? (
                    <p className="text-xs text-red-700">Enter a valid registrar address.</p>
                  ) : (
                    <p className="text-xs leading-5 text-neutral-600">
                      Uses the Sepolia ENS Name Wrapper by default so minted works can become 001.collection.artist.eth.
                    </p>
                  )}
                  <label className="block text-xs uppercase tracking-wide text-neutral-500">Artwork resolver</label>
                  <input
                    className="w-full border border-line p-2 font-mono text-xs"
                    onChange={(event) => {
                      setEnsResolverInput(event.target.value);
                      setEnsConfigError(null);
                    }}
                    placeholder="Defaults to the collection resolver"
                    value={ensResolverInput}
                  />
                  {invalidEnsResolver ? <p className="text-xs text-red-700">Enter a valid resolver address.</p> : null}
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 border border-ink px-4 py-2 text-sm hover:bg-paper disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
                    disabled={configuringEns || invalidEnsRegistrar || invalidEnsResolver}
                    onClick={() => void configureEnsSubnames()}
                  >
                    {configuringEns ? <Loader2 className="animate-spin" size={16} /> : null}
                    Configure ENS Subnames
                  </button>
                  {ensConfigError ? <p className="text-xs leading-5 text-red-700">{ensConfigError}</p> : null}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-neutral-700">
                  Connect the package owner wallet to configure the collection subregistry/registrar for mint-time ENS subname creation.
                </p>
              )}
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
