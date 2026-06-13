import { CollectionMint } from "./collection-mint";

export default async function CollectionPage({ params }: { params: Promise<{ collectionENS: string }> }) {
  const { collectionENS } = await params;
  return <CollectionMint collectionENS={decodeURIComponent(collectionENS)} />;
}
