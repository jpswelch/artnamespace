"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { RecordTable } from "@/components/record-table";
import { StatusPill } from "@/components/status-pill";
import { ENS_TEXT_KEYS } from "@/lib/constants";
import { loadArtwork } from "@/lib/local-cache";
import type { ProvenanceManifest } from "@/lib/art/types";
import { walrusProxyUrl } from "@/lib/walrus";

export function ArtworkProvenance({ artworkENS }: { artworkENS: string }) {
  const [records, setRecords] = useState<Record<string, string>>({});
  const [manifest, setManifest] = useState<ProvenanceManifest | null>(null);
  const [status, setStatus] = useState("Reading ENS records");

  useEffect(() => {
    async function load() {
      const local = loadArtwork(artworkENS);
      if (local) setManifest(local);

      try {
        const { readEnsTextRecords } = await import("@/lib/ens");
        const ensRecords = await readEnsTextRecords({
          name: artworkENS,
          keys: [
            ENS_TEXT_KEYS.tokenId,
            ENS_TEXT_KEYS.seed,
            ENS_TEXT_KEYS.paramsHash,
            ENS_TEXT_KEYS.metadataURI,
            ENS_TEXT_KEYS.renderURI,
            ENS_TEXT_KEYS.algorithmHash,
            ENS_TEXT_KEYS.contract,
            ENS_TEXT_KEYS.manifestURI,
          ],
        });
        setRecords(ensRecords);
        const manifestUri = ensRecords[ENS_TEXT_KEYS.manifestURI];
        if (manifestUri) {
          const response = await fetch(walrusProxyUrl(manifestUri));
          if (response.ok) {
            setManifest((await response.json()) as ProvenanceManifest);
          }
        }
        setStatus("ENS and Walrus records loaded");
      } catch {
        setStatus("Showing locally cached provenance");
      }
    }

    void load();
  }, [artworkENS]);

  const renderURI = records[ENS_TEXT_KEYS.renderURI] || manifest?.renderURI;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 border-b border-line pb-6">
        <StatusPill tone="good">Provenance</StatusPill>
        <h1 className="mt-4 break-words font-serif text-5xl">{artworkENS}</h1>
        <p className="mt-3 text-neutral-700">{status}</p>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="border border-line bg-paper p-4">
          {renderURI ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={artworkENS} className="aspect-square w-full object-contain" src={walrusProxyUrl(renderURI)} />
          ) : (
            <div className="grid aspect-square place-items-center border border-dashed border-neutral-400 text-neutral-500">No render URI yet</div>
          )}
        </div>

        <aside className="space-y-6">
          {manifest ? (
            <div className="border border-line p-4">
              <h2 className="font-serif text-2xl">Manifest</h2>
              <dl className="mt-4 space-y-3 font-mono text-xs">
                <div>
                  <dt className="text-neutral-500">Artist</dt>
                  <dd>{manifest.artistENS}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Collection</dt>
                  <dd>{manifest.collectionENS}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Token</dt>
                  <dd>{manifest.tokenId}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Features</dt>
                  <dd>{Object.entries(manifest.features).map(([key, value]) => `${key}: ${value}`).join(" / ")}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div>
            <h2 className="mb-3 font-serif text-2xl">ENS text records</h2>
            <RecordTable records={records} />
          </div>

          {manifest?.metadataURI ? (
            <a className="inline-flex items-center gap-2 border border-ink px-4 py-2 text-sm hover:bg-paper" href={walrusProxyUrl(manifest.metadataURI)} target="_blank">
              Metadata JSON <ExternalLink size={16} />
            </a>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
