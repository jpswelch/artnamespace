# Lumen Loom

Second ArtNamespace p5.js package for testing a different artist account.

Before publishing with another account:

1. In `/create`, set **Artist ENS root** to that account's Sepolia ENS root.
2. Pre-create the collection subname:

```text
lumenloom.<artistRoot>
```

3. Pre-create at least the first artwork subname:

```text
001.lumenloom.<artistRoot>
```

4. Make sure the publishing/minting wallet owns those subnames and each has a resolver.

Zip this folder before uploading:

```bash
zip -r lumenloom.zip manifest.json params.schema.json sketch.js README.md
```
