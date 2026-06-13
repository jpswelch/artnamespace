# Demo Script

Target: under four minutes.

## 0:00-0:20 Problem

Generative art platforms usually expose opaque token metadata. The NFT may exist, but the generated output rarely has a human-readable, resolvable identity tied to the artist namespace.

## 0:20-0:45 Solution

ArtNamespace lets artists publish creative-code algorithms under an ENS name. Each minted output becomes a unique NFT and receives its own ENS subname under the artist collection namespace.

## 0:45-1:30 Artist Flow

- Connect Sepolia wallet.
- Show the configured artist ENS root.
- Load the Curvefields sample package.
- Preview deterministic outputs.
- Publish the algorithm bundle to Walrus.
- Write collection records to `curvefields.<artistRoot>`.

## 1:30-2:30 Collector Flow

- Open `/collection/curvefields.<artistRoot>`.
- Render the next deterministic output.
- Mint a free Sepolia NFT.
- Upload params, render, metadata, and provenance manifest to Walrus.
- Write artwork records to `001.curvefields.<artistRoot>`.

## 2:30-3:20 Provenance

- Open `/art/001.curvefields.<artistRoot>`.
- Show artwork render from Walrus.
- Show ENS artwork name, seed, params hash, metadata URI, render URI, algorithm hash, token ID, and contract.

## 3:20-4:00 Sponsor Fit

ENS is the canonical naming and provenance layer. Walrus stores the creative recipe and generated artifacts. The result is a launch platform where every generated artwork is a named, resolvable digital object.
