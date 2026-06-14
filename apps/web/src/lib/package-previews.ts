export type PackagePreview = {
  name: string;
  slug: string;
  description: string;
  artistENS: string;
  collectionENS: string;
  maxSupply: number;
  previewSrc: string;
};

export const FEATURED_PACKAGES: PackagePreview[] = [
  {
    name: "Curvefields",
    slug: "curvefields",
    description: "A deterministic field study of curves, density, symmetry, and quiet motion.",
    artistENS: "artnamespace-demo.eth",
    collectionENS: "curvefields.artnamespace-demo.eth",
    maxSupply: 512,
    previewSrc: "/previews/curvefields.png?v=b88dd0c9",
  },
  {
    name: "Lumen Loom",
    slug: "lumenloom",
    description: "A deterministic woven-light study of rings, threads, glow, and interference.",
    artistENS: "knicks-won.eth",
    collectionENS: "lumenloom.knicks-won.eth",
    maxSupply: 128,
    previewSrc: "/previews/lumenloom.png?v=ee279f81",
  },
];

export function previewForCollection(collectionENS: string) {
  const slug = collectionENS.split(".")[0]?.toLowerCase();
  return FEATURED_PACKAGES.find((pkg) => pkg.slug === slug)?.previewSrc;
}
