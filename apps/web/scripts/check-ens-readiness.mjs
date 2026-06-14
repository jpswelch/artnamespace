import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http, isAddress, zeroAddress } from "viem";
import { namehash, normalize } from "viem/ens";
import { sepolia } from "viem/chains";

const SEPOLIA_ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const SEPOLIA_NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const ZERO_NODE = `0x${"00".repeat(32)}`;

const registryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
];

const nameWrapperAbi = [
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
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "canModifyName",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "addr", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
];

const factoryAbi = [
  {
    type: "function",
    name: "hashCollectionENS",
    stateMutability: "pure",
    inputs: [{ name: "collectionENS", type: "string" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "projectForCollectionHash",
    stateMutability: "view",
    inputs: [{ name: "collectionHash", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
];

const projectAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "ensSubnameRegistrar",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "ensParentNode",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "ensResolver",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function usage() {
  console.log("Usage: pnpm --filter @artnamespace/web ens:check <collection.eth> [projectContract]");
  console.log("");
  console.log("Examples:");
  console.log("  pnpm --filter @artnamespace/web ens:check signalgarden.knicks-won.eth");
  console.log("  pnpm --filter @artnamespace/web ens:check signalgarden.knicks-won.eth 0xProject...");
}

function sameAddress(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function statusLine(kind, message) {
  const labels = {
    pass: "PASS",
    fail: "FAIL",
    warn: "WARN",
    info: "INFO",
  };
  console.log(`[${labels[kind]}] ${message}`);
}

async function readSafe(label, fn) {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${message}`);
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), "../../.env"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const [collectionArg, projectArg] = process.argv.slice(2);
  if (!collectionArg || collectionArg === "--help" || collectionArg === "-h") {
    usage();
    process.exit(collectionArg ? 0 : 1);
  }

  const collectionENS = normalize(collectionArg);
  const explicitProject = projectArg && isAddress(projectArg) ? projectArg : undefined;
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL;
  const factory = process.env.NEXT_PUBLIC_ARTNAMESPACE_FACTORY;

  if (!rpcUrl) {
    throw new Error("Missing NEXT_PUBLIC_SEPOLIA_RPC_URL or SEPOLIA_RPC_URL.");
  }

  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const node = namehash(collectionENS);
  const universalResolver = await client.getEnsResolver({ name: collectionENS }).catch(() => null);
  const registryOwner = await readSafe("ENS registry owner", () =>
    client.readContract({
      address: SEPOLIA_ENS_REGISTRY,
      abi: registryAbi,
      functionName: "owner",
      args: [node],
    }),
  );
  const registryResolver = await readSafe("ENS registry resolver", () =>
    client.readContract({
      address: SEPOLIA_ENS_REGISTRY,
      abi: registryAbi,
      functionName: "resolver",
      args: [node],
    }),
  );
  const [wrappedOwner, fuses, expiry] = await readSafe("ENS Name Wrapper data", () =>
    client.readContract({
      address: SEPOLIA_NAME_WRAPPER,
      abi: nameWrapperAbi,
      functionName: "getData",
      args: [BigInt(node)],
    }),
  );

  let project = explicitProject || zeroAddress;
  if (!explicitProject && factory && isAddress(factory)) {
    const collectionHash = await readSafe("factory collection hash", () =>
      client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "hashCollectionENS",
        args: [collectionENS],
      }),
    );
    project = await readSafe("factory project lookup", () =>
      client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "projectForCollectionHash",
        args: [collectionHash],
      }),
    );
  }

  let projectOwner = zeroAddress;
  let projectRegistrar = zeroAddress;
  let projectParentNode = ZERO_NODE;
  let projectResolver = zeroAddress;
  if (project !== zeroAddress) {
    [projectOwner, projectRegistrar, projectParentNode, projectResolver] = await readSafe("project ENS config", () =>
      Promise.all([
        client.readContract({ address: project, abi: projectAbi, functionName: "owner" }),
        client.readContract({ address: project, abi: projectAbi, functionName: "ensSubnameRegistrar" }),
        client.readContract({ address: project, abi: projectAbi, functionName: "ensParentNode" }),
        client.readContract({ address: project, abi: projectAbi, functionName: "ensResolver" }),
      ]),
    );
  }

  console.log(`ENS readiness for ${collectionENS}`);
  console.log(`node: ${node}`);
  console.log(`factory: ${factory || "(not configured)"}`);
  console.log(`project: ${project === zeroAddress ? "(not found)" : project}`);
  console.log(`project owner: ${projectOwner === zeroAddress ? "(unknown)" : projectOwner}`);
  console.log(`universal resolver: ${universalResolver || "(none)"}`);
  console.log(`registry owner: ${registryOwner}`);
  console.log(`registry resolver: ${registryResolver}`);
  console.log(`wrapped owner: ${wrappedOwner}`);
  console.log(`wrapped fuses: ${fuses}`);
  console.log(`wrapped expiry: ${expiry}`);
  console.log("");

  let failed = false;

  if (!universalResolver) {
    statusLine("warn", "The name does not currently resolve through the Universal Resolver.");
  }

  if (registryOwner === zeroAddress && wrappedOwner === zeroAddress) {
    failed = true;
    statusLine(
      "fail",
      "This name is neither owned in the Sepolia ENS Registry nor wrapped in the Name Wrapper. The Name Wrapper path cannot create token subnames under it.",
    );
    statusLine(
      "info",
      "Use an on-chain ENS subname for the collection, or configure ArtNamespaceProject with the real ENSv2 subregistry/registrar for this name.",
    );
  } else if (wrappedOwner === zeroAddress) {
    statusLine("warn", "The collection is registry-owned but not wrapped yet. The app will try NameWrapper.wrap(...).");
    if (projectOwner !== zeroAddress) {
      const registryApproved = await readSafe("registry operator approval", () =>
        client.readContract({
          address: SEPOLIA_ENS_REGISTRY,
          abi: registryAbi,
          functionName: "isApprovedForAll",
          args: [registryOwner, projectOwner],
        }),
      );
      if (sameAddress(registryOwner, projectOwner) || registryApproved) {
        statusLine("pass", "The project owner wallet can wrap the collection name.");
      } else {
        failed = true;
        statusLine("fail", `The project owner ${projectOwner} is not the registry owner/manager for this collection name.`);
      }
    }
  } else {
    statusLine("pass", "The collection is wrapped.");
  }

  if (project === zeroAddress) {
    statusLine("warn", "No project contract was found. Publish the collection before checking project approval.");
  } else {
    if (!sameAddress(projectRegistrar, SEPOLIA_NAME_WRAPPER)) {
      failed = true;
      statusLine("fail", `Project registrar is ${projectRegistrar}, expected Sepolia Name Wrapper ${SEPOLIA_NAME_WRAPPER}.`);
    } else {
      statusLine("pass", "Project registrar is the Sepolia Name Wrapper.");
    }

    if (projectParentNode.toLowerCase() !== node.toLowerCase()) {
      failed = true;
      statusLine("fail", `Project parent node is ${projectParentNode}, expected ${node}.`);
    } else {
      statusLine("pass", "Project parent node matches the collection.");
    }

    if (projectResolver === zeroAddress) {
      failed = true;
      statusLine("fail", "Project ENS resolver is not configured.");
    } else {
      statusLine("pass", `Project ENS resolver is configured: ${projectResolver}.`);
    }

    if (wrappedOwner !== zeroAddress) {
      const wrapperApproved = await readSafe("Name Wrapper project approval", () =>
        client.readContract({
          address: SEPOLIA_NAME_WRAPPER,
          abi: nameWrapperAbi,
          functionName: "isApprovedForAll",
          args: [wrappedOwner, project],
        }),
      );
      const canProjectModify = await readSafe("Name Wrapper canModifyName", () =>
        client.readContract({
          address: SEPOLIA_NAME_WRAPPER,
          abi: nameWrapperAbi,
          functionName: "canModifyName",
          args: [node, project],
        }),
      );

      if (wrapperApproved && canProjectModify) {
        statusLine("pass", "ArtNamespaceProject is approved to create wrapped token subnames.");
      } else {
        failed = true;
        statusLine("fail", "ArtNamespaceProject is not approved to create wrapped token subnames.");
      }
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
