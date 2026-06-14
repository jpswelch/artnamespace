import {
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  stringToHex,
  toHex,
  zeroAddress,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { normalize, packetToBytes } from "viem/ens";
import { sepolia } from "viem/chains";
import { getResolverForName } from "./ens";

export const ENSV2_ROLE_REGISTRAR = 1n << 0n;
export const ENSV2_ROLE_SET_SUBREGISTRY = 1n << 20n;
export const ENSV2_ROLE_SET_RESOLVER = 1n << 24n;
export const ENSV2_ALL_ROLES = BigInt("0x1111111111111111111111111111111111111111111111111111111111111111");
export const ENSV2_MAX_EXPIRY = (1n << 64n) - 1n;
export const ENSV2_TOKEN_ROLE_BITMAP = 0n;

const DEFAULT_SEPOLIA_ENSV2_REGISTRY = "0xdedb92913a25abe1f7bcdd85d8a344a43b398b67";
const DEFAULT_SEPOLIA_ENSV2_UNIVERSAL_RESOLVER = "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe";
const DEFAULT_SEPOLIA_ENSV2_VERIFIABLE_FACTORY = "0xd2a632d8a8b67c2c4398c255cbd7af8dd7236198";
const DEFAULT_SEPOLIA_ENSV2_USER_REGISTRY_IMPL = "0x0f99e7ea74903afcb7224d0354fd7428a6f92917";

export const ensV2RegistryAbi = [
  {
    type: "function",
    name: "getSubregistry",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getResolver",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "registry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setSubregistry",
    stateMutability: "nonpayable",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "registry", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hasRoles",
    stateMutability: "view",
    inputs: [
      { name: "resource", type: "uint256" },
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "grantRootRoles",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
] as const;

const ensV2VerifiableFactoryAbi = [
  {
    type: "function",
    name: "deployProxy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "proxy", type: "address" }],
  },
  {
    type: "event",
    name: "ProxyDeployed",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "proxyAddress", type: "address", indexed: true },
      { name: "salt", type: "uint256", indexed: false },
      { name: "implementation", type: "address", indexed: false },
    ],
    anonymous: false,
  },
] as const;

const ensV2UniversalResolverAbi = [
  {
    type: "function",
    name: "findRegistries",
    stateMutability: "view",
    inputs: [{ name: "name", type: "bytes" }],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;

const ensV2UserRegistryInitAbi = [
  {
    type: "function",
    name: "initialize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "admin", type: "address" },
      { name: "roleBitmap", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

function envAddress(value: string | undefined, fallback: string): Address {
  const candidate = value || fallback;
  if (!isAddress(candidate)) {
    throw new Error(`Invalid ENSv2 Sepolia address configured: ${candidate}`);
  }

  return getAddress(candidate);
}

export function getEnsV2SepoliaAddresses() {
  return {
    rootRegistry: envAddress(process.env.NEXT_PUBLIC_ENSV2_REGISTRY, DEFAULT_SEPOLIA_ENSV2_REGISTRY),
    universalResolver: envAddress(
      process.env.NEXT_PUBLIC_ENSV2_UNIVERSAL_RESOLVER,
      DEFAULT_SEPOLIA_ENSV2_UNIVERSAL_RESOLVER,
    ),
    verifiableFactory: envAddress(
      process.env.NEXT_PUBLIC_ENSV2_VERIFIABLE_FACTORY,
      DEFAULT_SEPOLIA_ENSV2_VERIFIABLE_FACTORY,
    ),
    userRegistryImplementation: envAddress(
      process.env.NEXT_PUBLIC_ENSV2_USER_REGISTRY_IMPL,
      DEFAULT_SEPOLIA_ENSV2_USER_REGISTRY_IMPL,
    ),
  };
}

export function ensV2LabelId(label: string) {
  return BigInt(keccak256(stringToHex(normalize(label))));
}

function labelsForName(name: string) {
  return normalize(name)
    .split(".")
    .map((label) => label.trim())
    .filter(Boolean);
}

function randomSalt() {
  const random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  return (BigInt(Date.now()) << 64n) + BigInt(random);
}

async function waitForSuccess(publicClient: PublicClient, hash: `0x${string}`, action: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${action} transaction reverted.`);
  }

  return receipt;
}

export async function findEnsV2Registries(input: {
  publicClient: PublicClient;
  name: string;
}) {
  const addresses = getEnsV2SepoliaAddresses();
  const name = normalize(input.name);

  return input.publicClient.readContract({
    address: addresses.universalResolver,
    abi: ensV2UniversalResolverAbi,
    functionName: "findRegistries",
    args: [toHex(packetToBytes(name))],
  });
}

export async function getEnsV2RegistryForName(input: {
  publicClient: PublicClient;
  name: string;
}) {
  const discovered = await findEnsV2Registries(input).catch(() => []);
  const exactRegistry = discovered[0];

  if (exactRegistry && exactRegistry !== zeroAddress) {
    return getAddress(exactRegistry);
  }

  const labels = labelsForName(input.name);
  const addresses = getEnsV2SepoliaAddresses();
  let registry = addresses.rootRegistry;

  for (const label of [...labels].reverse()) {
    const next = await input.publicClient.readContract({
      address: registry,
      abi: ensV2RegistryAbi,
      functionName: "getSubregistry",
      args: [label],
    });

    if (next === zeroAddress) {
      return zeroAddress;
    }

    registry = getAddress(next);
  }

  return registry;
}

export async function deployEnsV2UserRegistry(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
}) {
  const addresses = getEnsV2SepoliaAddresses();
  const initData = encodeFunctionData({
    abi: ensV2UserRegistryInitAbi,
    functionName: "initialize",
    args: [input.account, ENSV2_ALL_ROLES],
  });
  const salt = randomSalt();
  const hash = await input.walletClient.writeContract({
    account: input.account,
    chain: sepolia,
    address: addresses.verifiableFactory,
    abi: ensV2VerifiableFactoryAbi,
    functionName: "deployProxy",
    args: [addresses.userRegistryImplementation, salt, initData],
  });
  const receipt = await waitForSuccess(input.publicClient, hash, "ENSv2 registry deployment");

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== addresses.verifiableFactory.toLowerCase()) continue;

    try {
      const decoded = decodeEventLog({
        abi: ensV2VerifiableFactoryAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "ProxyDeployed") {
        return getAddress(decoded.args.proxyAddress);
      }
    } catch {
      // Ignore unrelated factory logs.
    }
  }

  throw new Error("ENSv2 registry deployment succeeded, but the new registry address was not emitted.");
}

export async function ensureEnsV2RegistryForName(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  name: string;
  onStatus?: (status: string) => void;
}) {
  const normalizedName = normalize(input.name);
  const labels = labelsForName(normalizedName);
  const label = labels[0];
  const discovered = await findEnsV2Registries({
    publicClient: input.publicClient,
    name: normalizedName,
  }).catch(() => []);
  const exactRegistry = discovered[0];

  if (exactRegistry && exactRegistry !== zeroAddress) {
    return getAddress(exactRegistry);
  }

  const parentRegistry = discovered[1];

  if (!label || !parentRegistry || parentRegistry === zeroAddress) {
    throw new Error(
      `No ENSv2 parent registry was found for ${normalizedName}. Register or migrate the parent name in ENSv2 before creating token subnames.`,
    );
  }

  input.onStatus?.(`Deploying ENSv2 subregistry for ${normalizedName}`);
  const deployed = await deployEnsV2UserRegistry(input);
  const labelId = ensV2LabelId(label);
  const canSetSubregistry = await input.publicClient
    .readContract({
      address: parentRegistry,
      abi: ensV2RegistryAbi,
      functionName: "hasRoles",
      args: [labelId, ENSV2_ROLE_SET_SUBREGISTRY, input.account],
    })
    .catch(() => false);

  if (!canSetSubregistry) {
    throw new Error(
      `${input.account} does not have ENSv2 ROLE_SET_SUBREGISTRY for ${normalizedName}. Grant that role in explorer.ens.dev or choose an ENS name this wallet can manage.`,
    );
  }

  await input.publicClient.simulateContract({
    account: input.account,
    address: parentRegistry,
    abi: ensV2RegistryAbi,
    functionName: "setSubregistry",
    args: [labelId, deployed],
  });

  input.onStatus?.(`Attaching ENSv2 subregistry for ${normalizedName}`);
  const hash = await input.walletClient.writeContract({
    account: input.account,
    chain: sepolia,
    address: parentRegistry,
    abi: ensV2RegistryAbi,
    functionName: "setSubregistry",
    args: [labelId, deployed],
  });
  await waitForSuccess(input.publicClient, hash, `ENSv2 subregistry attach for ${normalizedName}`);

  return deployed;
}

export async function ensureEnsV2CollectionNamespace(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  collectionEns: string;
  resolver?: Address;
  onStatus?: (status: string) => void;
}) {
  const collectionEns = normalize(input.collectionEns);
  const [collectionLabel, ...parentLabels] = labelsForName(collectionEns);
  const parentName = parentLabels.join(".");

  if (!collectionLabel || !parentName) {
    throw new Error(`ENSv2 collection names must be subnames, received ${collectionEns}.`);
  }

  const existingCollectionRegistry = await getEnsV2RegistryForName({
    publicClient: input.publicClient,
    name: collectionEns,
  });
  const collectionResolver = input.resolver || (await getResolverForName(input.publicClient, parentName));

  if (!collectionResolver) {
    throw new Error(`No resolver is configured for ${parentName}. Configure the parent ENS resolver before publishing.`);
  }

  if (existingCollectionRegistry !== zeroAddress) {
    return {
      artistRegistry: await getEnsV2RegistryForName({ publicClient: input.publicClient, name: parentName }),
      collectionRegistry: getAddress(existingCollectionRegistry),
      collectionResolver: getAddress(collectionResolver),
      createdCollectionRegistry: false,
    };
  }

  const artistRegistry = await ensureEnsV2RegistryForName({
    publicClient: input.publicClient,
    walletClient: input.walletClient,
    account: input.account,
    name: parentName,
    onStatus: input.onStatus,
  });

  input.onStatus?.(`Deploying ENSv2 token subregistry for ${collectionEns}`);
  const collectionRegistry = await deployEnsV2UserRegistry(input);

  try {
    await input.publicClient.simulateContract({
      account: input.account,
      address: artistRegistry,
      abi: ensV2RegistryAbi,
      functionName: "register",
      args: [
        collectionLabel,
        input.account,
        collectionRegistry,
        getAddress(collectionResolver),
        ENSV2_ALL_ROLES,
        ENSV2_MAX_EXPIRY,
      ],
    });

    input.onStatus?.(`Creating ENSv2 collection subname ${collectionEns}`);
    const registerHash = await input.walletClient.writeContract({
      account: input.account,
      chain: sepolia,
      address: artistRegistry,
      abi: ensV2RegistryAbi,
      functionName: "register",
      args: [
        collectionLabel,
        input.account,
        collectionRegistry,
        getAddress(collectionResolver),
        ENSV2_ALL_ROLES,
        ENSV2_MAX_EXPIRY,
      ],
    });
    await waitForSuccess(input.publicClient, registerHash, `ENSv2 collection registration for ${collectionEns}`);
  } catch {
    const labelId = ensV2LabelId(collectionLabel);

    try {
      await input.publicClient.simulateContract({
        account: input.account,
        address: artistRegistry,
        abi: ensV2RegistryAbi,
        functionName: "setSubregistry",
        args: [labelId, collectionRegistry],
      });
    } catch {
      throw new Error(
        `${collectionEns} could not be registered or assigned a token subregistry. Confirm this wallet has registrar/subregistry permissions for ${parentName}.`,
      );
    }

    input.onStatus?.(`Attaching ENSv2 token subregistry for ${collectionEns}`);
    const attachHash = await input.walletClient.writeContract({
      account: input.account,
      chain: sepolia,
      address: artistRegistry,
      abi: ensV2RegistryAbi,
      functionName: "setSubregistry",
      args: [labelId, collectionRegistry],
    });
    await waitForSuccess(input.publicClient, attachHash, `ENSv2 token subregistry attach for ${collectionEns}`);
  }

  return {
    artistRegistry,
    collectionRegistry,
    collectionResolver: getAddress(collectionResolver),
    createdCollectionRegistry: true,
  };
}

export async function ensureEnsV2ProjectRegistrarRole(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  collectionRegistry: Address;
  projectContract: Address;
}) {
  const hasRole = await input.publicClient
    .readContract({
      address: input.collectionRegistry,
      abi: ensV2RegistryAbi,
      functionName: "hasRoles",
      args: [0n, ENSV2_ROLE_REGISTRAR, input.projectContract],
    })
    .catch(() => false);

  if (hasRole) {
    return;
  }

  await input.publicClient.simulateContract({
    account: input.account,
    address: input.collectionRegistry,
    abi: ensV2RegistryAbi,
    functionName: "grantRootRoles",
    args: [ENSV2_ROLE_REGISTRAR, input.projectContract],
  });

  const hash = await input.walletClient.writeContract({
    account: input.account,
    chain: sepolia,
    address: input.collectionRegistry,
    abi: ensV2RegistryAbi,
    functionName: "grantRootRoles",
    args: [ENSV2_ROLE_REGISTRAR, input.projectContract],
  });
  await waitForSuccess(input.publicClient, hash, "ENSv2 ArtNamespaceProject registrar grant");
}
