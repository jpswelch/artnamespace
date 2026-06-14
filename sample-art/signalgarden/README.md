# Signal Garden

Fresh ArtNamespace p5.js package for testing a new upload flow.

When publishing:

1. Connect the creator wallet.
2. Enter that wallet's Sepolia ENS root on `/create`.
3. Pre-create the collection subname:

```text
signalgarden.<creatorEns>
```

4. Pre-create at least the first artwork subname:

```text
001.signalgarden.<creatorEns>
```

The app overwrites `artistENS` with the ENS root entered on `/create`, so this package can be reused by any creator account that owns or manages the target ENS subnames.
