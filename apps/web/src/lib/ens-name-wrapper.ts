import { toHex, zeroAddress, type PublicClient, type WalletClient } from "viem";
import { namehash, normalize, packetToBytes } from "viem/ens";
import { sepolia } from "viem/chains";

export const SEPOLIA_NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8" as const;
export const SEPOLIA_ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;

export const ensNameWrapperAbi = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getData",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "wrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "wrappedOwner", type: "address" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "wrapETH2LD",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "wrappedOwner", type: "address" },
      { name: "ownerControlledFuses", type: "uint16" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSubnodeRecord",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
] as const;

export const ensRegistryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export function isSepoliaNameWrapper(address?: string | null) {
  return Boolean(address && address.toLowerCase() === SEPOLIA_NAME_WRAPPER.toLowerCase());
}

export async function isNameWrapperApprovedForAll(input: {
  publicClient: PublicClient;
  account: `0x${string}`;
  operator: `0x${string}`;
}) {
  return input.publicClient.readContract({
    address: SEPOLIA_NAME_WRAPPER,
    abi: ensNameWrapperAbi,
    functionName: "isApprovedForAll",
    args: [input.account, input.operator],
  });
}

export async function ensureNameWrapperApproval(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: `0x${string}`;
  operator: `0x${string}`;
}) {
  const alreadyApproved = await isNameWrapperApprovedForAll(input);

  if (alreadyApproved) {
    return;
  }

  const tx = await input.walletClient.writeContract({
    account: input.account,
    chain: sepolia,
    address: SEPOLIA_NAME_WRAPPER,
    abi: ensNameWrapperAbi,
    functionName: "setApprovalForAll",
    args: [input.operator, true],
  });
  const receipt = await input.publicClient.waitForTransactionReceipt({ hash: tx });

  if (receipt.status !== "success") {
    throw new Error("The ENS Name Wrapper approval transaction reverted.");
  }

  const approved = await isNameWrapperApprovedForAll(input);
  if (!approved) {
    throw new Error("The ENS Name Wrapper approval was not confirmed on-chain.");
  }
}

export async function getWrappedNameOwner(input: {
  publicClient: PublicClient;
  name: string;
}) {
  const node = namehash(normalize(input.name));
  const [owner] = await input.publicClient.readContract({
    address: SEPOLIA_NAME_WRAPPER,
    abi: ensNameWrapperAbi,
    functionName: "getData",
    args: [BigInt(node)],
  });

  return owner;
}

export async function getEnsRegistryOwner(input: {
  publicClient: PublicClient;
  name: string;
}) {
  const node = namehash(normalize(input.name));
  return input.publicClient.readContract({
    address: SEPOLIA_ENS_REGISTRY,
    abi: ensRegistryAbi,
    functionName: "owner",
    args: [node],
  });
}

export async function ensureNameWrapped(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: `0x${string}`;
  name: string;
  resolver: `0x${string}`;
}) {
  const normalizedName = normalize(input.name);
  const wrappedOwner = await getWrappedNameOwner({
    publicClient: input.publicClient,
    name: normalizedName,
  });

  if (wrappedOwner !== zeroAddress) {
    return;
  }

  const labels = normalizedName.split(".");
  const isEth2Ld = labels.length === 2 && labels[1] === "eth";
  const registryOwner = isEth2Ld
    ? undefined
    : await getEnsRegistryOwner({
        publicClient: input.publicClient,
        name: normalizedName,
      });

  if (registryOwner === zeroAddress) {
    throw new Error(
      `${normalizedName} resolves through the ENS Universal Resolver, but it is not owned in the Sepolia ENS Registry, so the ENS Name Wrapper cannot wrap it. Create the collection as an on-chain ENS subname or provide an ENSv2 subregistry/registrar address for ArtNamespaceProject.`,
    );
  }

  let hash: `0x${string}`;

  if (isEth2Ld) {
    hash = await input.walletClient.writeContract({
      account: input.account,
      chain: sepolia,
      address: SEPOLIA_NAME_WRAPPER,
      abi: ensNameWrapperAbi,
      functionName: "wrapETH2LD",
      args: [labels[0], input.account, 0, input.resolver],
    });
  } else {
    hash = await input.walletClient.writeContract({
      account: input.account,
      chain: sepolia,
      address: SEPOLIA_NAME_WRAPPER,
      abi: ensNameWrapperAbi,
      functionName: "wrap",
      args: [toHex(packetToBytes(normalizedName)), input.account, input.resolver],
    });
  }
  const receipt = await input.publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`The ENS Name Wrapper transaction for ${normalizedName} reverted.`);
  }
}

export async function ensureNameWrapperSubnameAuthority(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: `0x${string}`;
  parentName: string;
  resolver: `0x${string}`;
  operator: `0x${string}`;
}) {
  const parentName = normalize(input.parentName);

  await ensureNameWrapped({
    publicClient: input.publicClient,
    walletClient: input.walletClient,
    account: input.account,
    name: parentName,
    resolver: input.resolver,
  });

  const wrappedOwner = await getWrappedNameOwner({
    publicClient: input.publicClient,
    name: parentName,
  });

  if (wrappedOwner === zeroAddress) {
    throw new Error(`${parentName} is not wrapped in the ENS Name Wrapper.`);
  }

  if (wrappedOwner.toLowerCase() !== input.account.toLowerCase()) {
    throw new Error(
      `${parentName} is wrapped, but it is owned by ${wrappedOwner}. Connect that wallet or transfer the wrapped name before granting ArtNamespaceProject subname permissions.`,
    );
  }

  await ensureNameWrapperApproval({
    publicClient: input.publicClient,
    walletClient: input.walletClient,
    account: input.account,
    operator: input.operator,
  });

  const approved = await isNameWrapperApprovedForAll({
    publicClient: input.publicClient,
    account: input.account,
    operator: input.operator,
  });

  if (!approved) {
    throw new Error(`ArtNamespaceProject ${input.operator} is not approved to create wrapped subnames for ${parentName}.`);
  }

  return {
    owner: wrappedOwner,
    parentNode: namehash(parentName),
  };
}
