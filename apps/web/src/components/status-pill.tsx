import { cx } from "@/lib/format";

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center border px-2 py-1 text-xs uppercase tracking-wide",
        tone === "neutral" && "border-line text-neutral-600",
        tone === "good" && "border-teal-700 text-teal-800",
        tone === "warn" && "border-amber-700 text-amber-800",
      )}
    >
      {children}
    </span>
  );
}
