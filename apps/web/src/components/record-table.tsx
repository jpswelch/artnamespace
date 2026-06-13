import { truncateMiddle } from "@/lib/format";

export function RecordTable({ records }: { records: Record<string, string | undefined> }) {
  return (
    <div className="overflow-hidden border border-line">
      {Object.entries(records).map(([key, value]) => (
        <div className="grid grid-cols-1 border-b border-line last:border-b-0 md:grid-cols-[220px_1fr]" key={key}>
          <div className="bg-paper px-3 py-2 font-mono text-xs text-neutral-600">{key}</div>
          <div className="break-words px-3 py-2 font-mono text-xs text-ink">{value ? truncateMiddle(value, 32) : "not set"}</div>
        </div>
      ))}
    </div>
  );
}
