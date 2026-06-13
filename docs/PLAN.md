# ArtNamespace Controlled Live Demo Plan

ArtNamespace is built as a controlled live hackathon demo:

- Next.js App Router frontend and API routes in `apps/web`
- Foundry ERC-721 contract in `contracts`
- Curvefields sample package in `sample-art/curvefields`
- Walrus Testnet storage through HTTP publisher/aggregator routes
- ENS text-record reads/writes on a new Sepolia artist namespace

The MVP path is artist upload/publish -> collector mint -> artwork provenance page.

## Live Demo Dependencies

- Sepolia wallet with test ETH
- New Sepolia ENS artist name, not `blkcipher.eth`
- Pre-created `curvefields.<artistRoot>` and first artwork subnames
- Deployed `ArtNamespaceDrop` contract
- Walrus Testnet publisher and aggregator URLs

## Scope Boundaries

No marketplace, auction, royalty dashboard, ENS registration wizard, AI generation, or non-p5 renderer is included in MVP.
