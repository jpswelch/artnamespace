# Architecture

```mermaid
flowchart LR
  Artist[Artist Wallet] --> Create[Next.js Create Flow]
  Create --> Renderer[Sandboxed p5 iframe]
  Create --> WalrusAPI[Next API Walrus Routes]
  WalrusAPI --> Walrus[Walrus Testnet]
  Create --> ENS[Sepolia ENS Resolver]
  Collector[Collector Wallet] --> Mint[Collection Mint Page]
  Mint --> Renderer
  Create --> Factory[ArtNamespaceFactory]
  Factory --> Project[Per-package ERC-721]
  Mint --> Project
  Mint --> WalrusAPI
  Mint --> ENS
  ENS --> Provenance[Artwork Provenance Page]
  Walrus --> Provenance
  Contract --> Provenance
```

## Data Flow

1. Artist uploads or loads a p5.js-compatible package.
2. The browser validates the package and lets the artist choose the one-time fixed mint price.
3. The extracted algorithm bundle is uploaded to Walrus.
4. The factory deploys a per-package ERC-721 with that fixed mint price.
5. Collection text records are written to the pre-created ENS collection name.
6. Collector renders the next deterministic output.
7. Params, render, NFT metadata, and provenance manifest are uploaded to Walrus.
8. The package ERC-721 is minted with the metadata URI, uniqueness hash, and package fixed mint price.
9. Artwork text records are written to the pre-created ENS artwork name.
10. The provenance page reads ENS and Walrus records back live.

## ENS Mode

The MVP uses `precreated` ENS mode. The app writes records to existing names that the demo wallet controls. This keeps the live demo focused on real resolver operations without risking subname registrar complexity during the hackathon.
