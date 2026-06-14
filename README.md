# ArtNamespace

Generative art with ENS-native provenance.

ArtNamespace is a hackathon MVP for publishing deterministic creative-code algorithms under an artist ENS namespace. Collectors mint unique outputs; each output receives an NFT, Walrus-stored artifacts, and ENS text records that make the artwork resolvable by name.

## Quick Start

```bash
pnpm install
cp .env.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`.

## Required Live Demo Setup

1. Register a new Sepolia ENS name for the artist demo, such as `artnamespace-demo.eth`.
2. Pre-create `curvefields.<artistRoot>` and at least one artwork subname such as `001.curvefields.<artistRoot>`.
3. Configure the resolver so the connected wallet can set text records.
4. Deploy `contracts/src/ArtNamespaceFactory.sol` to Sepolia with `make deploy-factory`.
5. Set `NEXT_PUBLIC_ARTIST_ENS_ROOT`, `NEXT_PUBLIC_ARTNAMESPACE_FACTORY`, `NEXT_PUBLIC_SEPOLIA_RPC_URL`, `WALRUS_PUBLISHER_URL`, and `WALRUS_AGGREGATOR_URL`.

## Vercel Deployment

Create the Vercel project from this repository and set the project root directory to `apps/web`. Keep the install command as `pnpm install`; the app postinstall step copies `p5.min.js` from the installed `p5` package into `public/vendor` for the sandboxed renderer.

Set the same environment variables from `.env.example` in Vercel. Do not set `WALRUS_MOCK=true` for the submitted live demo.

## ENS Integration

- Resolves artist and collection names.
- Deploys one ERC-721 package contract per artist project through the factory.
- Writes prefixed provenance text records to pre-created collection and artwork ENS names.
- Reads records back into collection and provenance pages.
- Uses ENS as the canonical artist -> collection -> artwork namespace.

## Walrus Integration

- Stores algorithm bundles, params, renders, NFT metadata, and provenance manifests.
- Reads Walrus blobs back through a server route so provenance pages can show stored artifacts.
- Supports Testnet HTTP publisher/aggregator endpoints, with `WALRUS_MOCK=true` only for local smoke testing.

## Commands

```bash
pnpm build
pnpm test:run
pnpm contracts:test
```

## Contract Deployment Helpers

```bash
make contracts-build
make contracts-test
make deploy-factory
make deploy-factory-verify
```

`make deploy-factory` expects `SEPOLIA_RPC_URL` or `NEXT_PUBLIC_SEPOLIA_RPC_URL` and uses the Foundry account `testkey` by default. Override it with `DEPLOYER_ACCOUNT=<account-name>` when needed. After deployment, copy the deployed address into `NEXT_PUBLIC_ARTNAMESPACE_FACTORY`.

See `docs/DEMO_SCRIPT.md` for the four-minute judge demo.
