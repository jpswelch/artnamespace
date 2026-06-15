import { ExternalLink } from "lucide-react";
import { isWalrusUri, walrusDirectUrl } from "@/lib/walrus";

export function RecordTable({ records }: { records: Record<string, string | undefined> }) {
  return (
    <div className="overflow-hidden border border-line">
      {Object.entries(records).map(([key, value]) => (
        <div className="grid grid-cols-1 border-b border-line last:border-b-0 md:grid-cols-[220px_1fr]" key={key}>
          <div className="min-w-0 break-all bg-paper px-3 py-2 font-mono text-xs text-neutral-600">{key}</div>
          <div className="min-w-0 px-3 py-2 font-mono text-xs text-ink">
            {value ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 break-all">{value}</span>
                {isWalrusUri(value) ? (
                  <a
                    className="inline-flex items-center gap-1 text-neutral-600 underline-offset-4 hover:text-ink hover:underline"
                    href={walrusDirectUrl(value)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open on Walrus <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
            ) : (
              "not set"
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
