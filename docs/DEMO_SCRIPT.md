# Demo Script

Target: under four minutes.

## 0:00-0:20 Problem

Most generative art NFTs are kind of a black box. You get a token, maybe an image, maybe some metadata… but it usually doesn’t have a clear name, identity, or trail back to the artist.

ArtNamespace fixes that.

## 0:20-0:45 Solution

Artists publish their creative-code algorithms under their own ENS name. Then every minted output becomes both a unique NFT and gets its own ENS subname inside that artist’s collection.

So instead of a random token ID floating around, each artwork becomes something you can actually name, resolve, and verify.

## 0:45-1:30 Artist Flow

- Connect Sepolia wallet.
- Show the configured artist ENS root.
- Load the Curvefields demo package.
- Preview deterministic outputs.
- Publish the algorithm bundle to Walrus.
- Deploy the package ERC-721 and write collection records to `curvefields.<artistRoot>`.
- Show that the package contract is configured to issue numbered artwork subnames under the collection.

## 1:30-2:30 Collector Flow

- Open `/collection/curvefields.<artistRoot>`.
- Render the next deterministic output.
- Mint a free Sepolia NFT.
- The package contract assigns `001.curvefields.<artistRoot>` as the artwork ENS name.
- Upload params, render, metadata, and provenance manifest to Walrus.
- Write artwork records to the minted artwork ENS name.

## 2:30-3:20 Provenance

- Open `/art/001.curvefields.<artistRoot>`.
- Show artwork render from Walrus.
- Show ENS artwork name, seed, params hash, metadata URI, render URI, algorithm hash, token ID, and contract.

## 3:20-4:00 Sponsor Fit

ENS gives the art its identity and provenance. Walrus stores the code, recipe, metadata, and generated files. Together, they turn every generated artwork into a real, named digital object — not just another anonymous NFT in the void.
