import { ArtworkProvenance } from "./provenance";

export default async function ArtworkPage({ params }: { params: Promise<{ artworkENS: string }> }) {
  const { artworkENS } = await params;
  return <ArtworkProvenance artworkENS={decodeURIComponent(artworkENS)} />;
}
