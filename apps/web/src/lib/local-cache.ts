import type { CollectionRecord, ProvenanceManifest } from "./art/types";

const COLLECTION_KEY = "artnamespace:lastCollection";
const ART_PREFIX = "artnamespace:art:";

export function saveCollection(record: CollectionRecord) {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(record));
}

export function loadCollection(): CollectionRecord | null {
  const raw = localStorage.getItem(COLLECTION_KEY);
  return raw ? (JSON.parse(raw) as CollectionRecord) : null;
}

export function saveArtwork(manifest: ProvenanceManifest) {
  localStorage.setItem(`${ART_PREFIX}${manifest.artworkENS}`, JSON.stringify(manifest));
}

export function loadArtwork(artworkENS: string): ProvenanceManifest | null {
  const raw = localStorage.getItem(`${ART_PREFIX}${artworkENS}`);
  return raw ? (JSON.parse(raw) as ProvenanceManifest) : null;
}
