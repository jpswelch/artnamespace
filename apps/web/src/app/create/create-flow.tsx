"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, FileUp, Loader2, Wand2 } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatEther, isAddress, zeroAddress, type Address } from "viem";
import { namehash, normalize } from "viem/ens";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { createAlgorithmBundle } from "@/lib/art/sample";
import { packageHash, parseArtPackage } from "@/lib/art/package";
import type { ArtPackage, CollectionRecord } from "@/lib/art/types";
import { artNamespaceFactoryAbi, artNamespaceProjectAbi } from "@/lib/contracts/artnamespace";
import { ENS_TEXT_KEYS, getCollectionEns, getFactoryAddress } from "@/lib/constants";
import { getResolverForName, publicResolverAbi, readEnsTextRecords, writeEnsTextRecords } from "@/lib/ens";
import {
  ENSV2_MAX_EXPIRY,
  ENSV2_TOKEN_ROLE_BITMAP,
  ensureEnsV2CollectionNamespace,
  ensureEnsV2ProjectRegistrarRole,
} from "@/lib/ens-v2";
import { SEPOLIA_NAME_WRAPPER, ensureNameWrapperSubnameAuthority, isSepoliaNameWrapper } from "@/lib/ens-name-wrapper";
import { loadCollection, saveCollection } from "@/lib/local-cache";
import { truncateMiddle } from "@/lib/format";
import { parseMintPriceEth } from "@/lib/price";
import { collectionSymbol, resolveProjectContract } from "@/lib/project";
import { useSepoliaEnsName } from "@/lib/use-sepolia-ens-name";
import { uploadWalrusArtifact } from "@/lib/walrus";

const ZERO_BYTES32 = `0x${"00".repeat(32)}` as const;

function normalizeEnsInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return normalize(trimmed);
  } catch {
    return "";
  }
}

function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function normalizeOptionalAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return isAddress(trimmed) ? (trimmed as `0x${string}`) : undefined;
}

export function CreateFlow() {
  const [pkg, setPkg] = useState<ArtPackage | null>(null);
  const [status, setStatus] = useState<string>("Choose or upload an algorithm package");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<CollectionRecord | null>(null);
  const [mintPriceInputEth, setMintPriceInputEth] = useState("0");
  const [subnameRegistrarInput, setSubnameRegistrarInput] = useState("");
  const [artworkResolverInput, setArtworkResolverInput] = useState("");
  const [creatorEnsOverride, setCreatorEnsOverride] = useState<{ address?: `0x${string}`; value: string } | null>(null);
  const { address } = useAccount();
  const { ensName, isLoading: loadingEnsName } = useSepoliaEnsName(address);
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });

  const overrideApplies = Boolean(creatorEnsOverride && creatorEnsOverride.address?.toLowerCase() === address?.toLowerCase());
  const creatorEnsInput = overrideApplies && creatorEnsOverride ? creatorEnsOverride.value : ensName || "";
  const creatorEns = useMemo(() => normalizeEnsInput(creatorEnsInput), [creatorEnsInput]);
  const creatorEnsText = creatorEnsInput.trim();
  const invalidCreatorEns = Boolean(creatorEnsText && !creatorEns);
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
  const subnameRegistrar = normalizeOptionalAddress(subnameRegistrarInput);
  const artworkResolver = normalizeOptionalAddress(artworkResolverInput);
  const invalidSubnameRegistrar = Boolean(subnameRegistrarInput.trim() && !subnameRegistrar);
  const invalidArtworkResolver = Boolean(artworkResolverInput.trim() && !artworkResolver);
  const missingCreatorEns = Boolean(address && !loadingEnsName && !creatorEns && !creatorEnsText);
  const creatorEnsHasProblem = Boolean(address && (missingCreatorEns || invalidCreatorEns));
  const creatorEnsStatus = !address
    ? "Connect a wallet, then enter the creator Sepolia ENS root."
    : invalidCreatorEns
      ? "Enter a valid Sepolia ENS name, such as artnamespace-demo.eth."
      : creatorEns
        ? creatorEns === ensName
          ? `Publishing under ${creatorEns} on Sepolia.`
          : `Publishing under ${creatorEns} on Sepolia. ENS write access will be checked when you publish.`
        : loadingEnsName
          ? "Checking reverse ENS. You can enter a Sepolia ENS name manually if it has not updated yet."
          : "No Sepolia reverse ENS name was found. Enter a Sepolia ENS name this wallet owns or manages.";
  const canPublish = Boolean(
    pkg &&
      address &&
      creatorEns &&
      !publishing &&
      !activePublished &&
      !invalidSubnameRegistrar &&
      !invalidArtworkResolver,
  );

  useEffect(() => {
    let cancelled = false;

    async function restorePublishedState() {
      const accountManifest = manifestForAccount;
      if (!collectionEns || !accountManifest) return;

      const local = loadCollection();
      const matchingLocal = local?.collectionENS === collectionEns ? local : null;

      if (matchingLocal?.contract && sameAddress(matchingLocal.factory, factory)) {
        if (!cancelled) {
          setPublished(matchingLocal);
          setMintPriceInputEth(formatEther(BigInt(matchingLocal.mintPriceWei || "0")));
          setSubnameRegistrarInput(matchingLocal.subnameRegistrar || "");
          setArtworkResolverInput(matchingLocal.artworkResolver || "");
          setStatus("Collection already published");
        }
        return;
      }

      if (matchingLocal?.contract && !sameAddress(matchingLocal.factory, factory) && !cancelled) {
        setPublished(null);
        setStatus("Collection has older publish records; publish again to relink it to the current factory");
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
            ENS_TEXT_KEYS.subnameRegistrar,
            ENS_TEXT_KEYS.subnameParentNode,
            ENS_TEXT_KEYS.artworkResolver,
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
        const isCurrentFactoryRecord = sameAddress(restoredFactory, factory);
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
          subnameRegistrar:
            records[ENS_TEXT_KEYS.subnameRegistrar] && isAddress(records[ENS_TEXT_KEYS.subnameRegistrar])
              ? (records[ENS_TEXT_KEYS.subnameRegistrar] as `0x${string}`)
              : undefined,
          subnameParentNode: records[ENS_TEXT_KEYS.subnameParentNode]?.startsWith("0x")
            ? (records[ENS_TEXT_KEYS.subnameParentNode] as `0x${string}`)
            : undefined,
          artworkResolver:
            records[ENS_TEXT_KEYS.artworkResolver] && isAddress(records[ENS_TEXT_KEYS.artworkResolver])
              ? (records[ENS_TEXT_KEYS.artworkResolver] as `0x${string}`)
              : undefined,
          publishedAt: matchingLocal?.publishedAt || new Date().toISOString(),
        };

        const projectOwner = isCurrentFactoryRecord
          ? await publicClient.readContract({
              address: projectContract,
              abi: artNamespaceProjectAbi,
              functionName: "owner",
            })
          : undefined;
        const isOwnedByCurrentWallet = sameAddress(projectOwner, address);

        if (isCurrentFactoryRecord && isOwnedByCurrentWallet) {
          saveCollection(restored);
        }

        if (!cancelled && isCurrentFactoryRecord && isOwnedByCurrentWallet) {
          setPublished(restored);
          setMintPriceInputEth(formatEther(BigInt(restored.mintPriceWei || "0")));
          setSubnameRegistrarInput(restored.subnameRegistrar || "");
          setArtworkResolverInput(restored.artworkResolver || "");
          setStatus("Collection already published");
        } else if (!cancelled && isCurrentFactoryRecord) {
          setPublished(null);
          setStatus("Collection already exists in the current factory under another wallet");
          setError("Connect the package owner wallet or use a different package slug/ENS subname.");
        } else if (!cancelled) {
          setPublished(null);
          setStatus("Collection exists in ENS with an older factory; publish again to relink it");
        }
      } catch {
        if (!cancelled && matchingLocal && sameAddress(matchingLocal.factory, factory)) {
          setPublished(matchingLocal);
          setMintPriceInputEth(formatEther(BigInt(matchingLocal.mintPriceWei || "0")));
          setSubnameRegistrarInput(matchingLocal.subnameRegistrar || "");
          setArtworkResolverInput(matchingLocal.artworkResolver || "");
          setStatus("Collection already published");
        }
      }
    }

    void restorePublishedState();

    return () => {
      cancelled = true;
    };
  }, [address, collectionEns, factory, manifestForAccount, publicClient]);

  async function onUpload(file: File) {
    setError(null);
    setPkg(null);
    setPublished(null);
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
      setStatus(`${parsed.manifest.name} package loaded`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Package could not be loaded");
    }
  }

  async function loadExamplePackage() {
    setError(null);
    setPublished(null);
    setStatus("Loading example package");

    try {
      const response = await fetch("/packages/curvefields.zip?v=b88dd0c9");
      if (!response.ok) {
        throw new Error("Example package could not be loaded.");
      }

      const blob = await response.blob();
      await onUpload(new File([blob], "curvefields.zip", { type: "application/zip" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Example package could not be loaded");
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

    if (creatorEnsText && !creatorEns) {
      setError("Enter a valid Sepolia ENS name before publishing.");
      return;
    }

    if (!creatorEns) {
      setError(
        loadingEnsName
          ? "Still checking reverse ENS. You can wait a moment or enter the Sepolia ENS name manually."
          : "Enter a Sepolia ENS name this wallet owns or manages before publishing.",
      );
      return;
    }

    if (!factory) {
      setError("Set NEXT_PUBLIC_ARTNAMESPACE_FACTORY before publishing package contracts.");
      return;
    }

    if (invalidSubnameRegistrar) {
      setError("Enter a valid ENSv2 collection registry address, or leave it blank.");
      return;
    }

    if (invalidArtworkResolver) {
      setError("Enter a valid artwork resolver address, or leave it blank.");
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const targetCollectionEns = getCollectionEns(creatorEns, pkg.manifest.slug);
      const packageForPublish: ArtPackage = {
        ...pkg,
        manifest: {
          ...pkg.manifest,
          artistENS: creatorEns,
        },
      };
      const bundle = createAlgorithmBundle(packageForPublish);
      const initialMintPriceWei = parseMintPriceEth(mintPriceInputEth);

      const collectionNode = namehash(normalize(targetCollectionEns));
      const manualSubnameRegistrar = normalizeOptionalAddress(subnameRegistrarInput);
      const manualArtworkResolver = normalizeOptionalAddress(artworkResolverInput);
      const creatorResolver = await getResolverForName(publicClient, creatorEns);

      if (!creatorResolver && !manualArtworkResolver) {
        throw new Error(`No resolver is configured for ${creatorEns}. Configure the parent ENS resolver before publishing.`);
      }

      let targetSubnameRegistrar: Address;
      let targetArtworkResolver: Address = manualArtworkResolver || (creatorResolver as Address);
      const useLegacyNameWrapper = Boolean(manualSubnameRegistrar && isSepoliaNameWrapper(manualSubnameRegistrar));

      if (useLegacyNameWrapper) {
        setStatus(`Checking ENS write access for ${targetCollectionEns}`);
        const collectionResolver = await getResolverForName(publicClient, targetCollectionEns);
        if (!collectionResolver && !manualArtworkResolver) {
          throw new Error(
            `No resolver is configured for ${targetCollectionEns}. Create or configure that collection subname before using the legacy Name Wrapper path.`,
          );
        }

        targetSubnameRegistrar = manualSubnameRegistrar as Address;
        targetArtworkResolver = manualArtworkResolver || (collectionResolver as Address);
      } else if (manualSubnameRegistrar) {
        targetSubnameRegistrar = manualSubnameRegistrar;
      } else {
        setStatus(`Preparing ENSv2 namespace for ${targetCollectionEns}`);
        const ensV2Setup = await ensureEnsV2CollectionNamespace({
          publicClient,
          walletClient,
          account: address,
          collectionEns: targetCollectionEns,
          resolver: manualArtworkResolver || (creatorResolver as Address),
          onStatus: setStatus,
        });
        targetSubnameRegistrar = ensV2Setup.collectionRegistry;
        targetArtworkResolver = ensV2Setup.collectionResolver;
      }

      try {
        setStatus(`Checking ENS text write access for ${targetCollectionEns}`);
        await publicClient.simulateContract({
          account: address,
          address: targetArtworkResolver,
          abi: publicResolverAbi,
          functionName: "setText",
          args: [collectionNode, "artnamespace.preflight", "ok"],
        });
      } catch {
        throw new Error(
          `This wallet cannot write ENS text records for ${targetCollectionEns}. Make sure it owns or manages that ENS name, then try again.`,
        );
      }

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
      const effectiveSubnameRegistrar = targetSubnameRegistrar;
      const effectiveSubnameParentNode = collectionNode;
      const effectiveArtworkResolver = targetArtworkResolver;

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
              creatorEns,
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
            creatorEns,
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
        const [existingOwner, existingCodeURI, existingAlgorithmHash, existingMintPriceWei] = await Promise.all([
          publicClient.readContract({
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "owner",
          }),
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
        if (!sameAddress(existingOwner, address)) {
          throw new Error(
            `This collection already has a package contract owned by ${existingOwner}. Connect that wallet or use a different package slug/ENS subname.`,
          );
        }
        codeURI = existingCodeURI;
        effectiveAlgorithmHash = existingAlgorithmHash;
        effectiveMintPriceWei = existingMintPriceWei;
        setMintPriceInputEth(formatEther(existingMintPriceWei));
      }

      setStatus("Configuring package ENS subname authority");
      const [currentRegistrar, currentParentNode, currentResolver, currentMode, currentRoleBitmap] = await Promise.all([
        publicClient.readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "ensSubnameRegistrar",
        }),
        publicClient.readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "ensParentNode",
        }),
        publicClient.readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "ensResolver",
        }),
        publicClient.readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "ensSubnameMode",
        }),
        publicClient.readContract({
          address: projectContract,
          abi: artNamespaceProjectAbi,
          functionName: "ensSubnameRoleBitmap",
        }),
      ]).catch(() => [zeroAddress, ZERO_BYTES32, zeroAddress, 0, 0n] as const);

      if (useLegacyNameWrapper) {
        setStatus("Granting ArtNamespaceProject permission to create ENS token subnames");
        await ensureNameWrapperSubnameAuthority({
          publicClient,
          walletClient,
          account: address,
          parentName: targetCollectionEns,
          resolver: targetArtworkResolver,
          operator: projectContract,
        });
        setStatus("Configuring package ENS subname authority");

        if (
          Number(currentMode) !== 1 ||
          !sameAddress(currentRegistrar, targetSubnameRegistrar) ||
          currentParentNode.toLowerCase() !== collectionNode.toLowerCase() ||
          !sameAddress(currentResolver, targetArtworkResolver)
        ) {
          const configureTx = await walletClient.writeContract({
            account: address,
            chain: sepolia,
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "configureEnsSubnames",
            args: [targetSubnameRegistrar, collectionNode, targetArtworkResolver, 0n, 0, 0n],
          });
          const configureReceipt = await publicClient.waitForTransactionReceipt({ hash: configureTx });
          if (configureReceipt.status !== "success") {
            throw new Error("The ENS subname configuration transaction reverted.");
          }
        }
      } else {
        setStatus("Granting ArtNamespaceProject ENSv2 registrar permission");
        await ensureEnsV2ProjectRegistrarRole({
          publicClient,
          walletClient,
          account: address,
          collectionRegistry: targetSubnameRegistrar,
          projectContract,
        });

        if (
          Number(currentMode) !== 2 ||
          !sameAddress(currentRegistrar, targetSubnameRegistrar) ||
          !sameAddress(currentResolver, targetArtworkResolver) ||
          currentRoleBitmap !== ENSV2_TOKEN_ROLE_BITMAP
        ) {
          setStatus("Configuring package ENSv2 token subname creation");
          const configureTx = await walletClient.writeContract({
            account: address,
            chain: sepolia,
            address: projectContract,
            abi: artNamespaceProjectAbi,
            functionName: "configureEnsV2Subnames",
            args: [targetSubnameRegistrar, targetArtworkResolver, ENSV2_MAX_EXPIRY, ENSV2_TOKEN_ROLE_BITMAP],
          });
          const configureReceipt = await publicClient.waitForTransactionReceipt({ hash: configureTx });
          if (configureReceipt.status !== "success") {
            throw new Error("The ENSv2 subname configuration transaction reverted.");
          }
        }
      }

      const record: CollectionRecord = {
        artistENS: creatorEns,
        collectionENS: targetCollectionEns,
        manifest: packageForPublish.manifest,
        algorithmHash: effectiveAlgorithmHash,
        codeURI,
        factory,
        contract: projectContract,
        mintPriceWei: effectiveMintPriceWei.toString(),
        subnameRegistrar: effectiveSubnameRegistrar,
        subnameParentNode: effectiveSubnameParentNode,
        artworkResolver: effectiveArtworkResolver,
        publishedAt: new Date().toISOString(),
      };

      setStatus(`Writing ENS text records for ${targetCollectionEns}`);
      await writeEnsTextRecords({
        publicClient,
        walletClient,
        account: address,
        name: targetCollectionEns,
        records: {
          [ENS_TEXT_KEYS.creator]: creatorEns,
          [ENS_TEXT_KEYS.collection]: packageForPublish.manifest.name,
          [ENS_TEXT_KEYS.algorithmHash]: effectiveAlgorithmHash,
          [ENS_TEXT_KEYS.codeURI]: codeURI,
          [ENS_TEXT_KEYS.factory]: factory,
          [ENS_TEXT_KEYS.projectContract]: projectContract,
          [ENS_TEXT_KEYS.contract]: projectContract,
          [ENS_TEXT_KEYS.mintPriceWei]: effectiveMintPriceWei.toString(),
          [ENS_TEXT_KEYS.maxSupply]: String(packageForPublish.manifest.maxSupply),
          [ENS_TEXT_KEYS.chain]: "sepolia",
          [ENS_TEXT_KEYS.subnameRegistrar]: effectiveSubnameRegistrar,
          [ENS_TEXT_KEYS.subnameParentNode]: effectiveSubnameParentNode,
          [ENS_TEXT_KEYS.artworkResolver]: effectiveArtworkResolver,
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
              onClick={() => void loadExamplePackage()}
            >
              <Wand2 size={16} /> Load Example Package
            </button>
          </div>

          <div className="border border-line p-4">
            {pkg ? (
              <>
                {pkg.previewDataUrl ? (
                  <Image
                    alt={`${pkg.manifest.name} package preview`}
                    className="mb-4 aspect-square w-full border border-line object-cover"
                    height={720}
                    src={pkg.previewDataUrl}
                    unoptimized
                    width={720}
                  />
                ) : null}
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
              className="mt-2 w-full border border-line p-2 font-mono text-sm"
              disabled={!address || publishing}
              onChange={(event) => {
                setCreatorEnsOverride({ address, value: event.target.value });
                setPublished(null);
                setError(null);
              }}
              placeholder={address ? "artnamespace-demo.eth" : "Connect wallet to enter Sepolia ENS"}
              value={creatorEnsInput}
            />
            <p className={`mt-2 text-xs leading-5 ${creatorEnsHasProblem ? "text-red-700" : "text-neutral-600"}`}>
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
            <details className="mt-4 border-t border-line pt-4">
              <summary className="cursor-pointer text-xs uppercase tracking-wide text-neutral-500">Advanced ENS settings</summary>
              <div className="mt-3 space-y-3">
                <label className="block text-xs uppercase tracking-wide text-neutral-500">ENSv2 collection registry override</label>
                <input
                  className="w-full border border-line p-2 font-mono text-sm disabled:bg-neutral-100"
                  disabled={Boolean(activePublished)}
                  onChange={(event) => {
                    setSubnameRegistrarInput(event.target.value);
                    setPublished(null);
                    setError(null);
                  }}
                  placeholder="Leave blank for automatic ENSv2 setup"
                  value={subnameRegistrarInput}
                />
                {invalidSubnameRegistrar ? (
                  <p className="text-xs text-red-700">Enter a valid registry address.</p>
                ) : (
                  <p className="text-xs leading-5 text-neutral-600">
                    Leave blank for automatic ENSv2 setup. To use the old Name Wrapper path, enter {SEPOLIA_NAME_WRAPPER}.
                  </p>
                )}
                <label className="block text-xs uppercase tracking-wide text-neutral-500">Artwork resolver</label>
                <input
                  className="w-full border border-line p-2 font-mono text-sm disabled:bg-neutral-100"
                  disabled={Boolean(activePublished)}
                  onChange={(event) => {
                    setArtworkResolverInput(event.target.value);
                    setPublished(null);
                    setError(null);
                  }}
                  placeholder="Defaults to the collection resolver"
                  value={artworkResolverInput}
                />
                {invalidArtworkResolver ? <p className="text-xs text-red-700">Enter a valid resolver address.</p> : null}
              </div>
            </details>
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
              [ENS_TEXT_KEYS.subnameRegistrar]: activePublished.subnameRegistrar,
              [ENS_TEXT_KEYS.subnameParentNode]: activePublished.subnameParentNode,
              [ENS_TEXT_KEYS.artworkResolver]: activePublished.artworkResolver,
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
