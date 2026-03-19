import { HearingStatus } from "../types/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  [HearingStatus.DETECTED]: { label: "Detected", color: "#6B7280", bg: "#E5E7EB" },
  [HearingStatus.RESOLVED]: { label: "Resolved", color: "#6B7280", bg: "#E5E7EB" },
  [HearingStatus.PREPARING]: { label: "Preparing", color: "#92400E", bg: "#FEF3C7" },
  [HearingStatus.READY]: { label: "Ready", color: "#0039A6", bg: "rgba(0,57,166,0.1)" },
  [HearingStatus.PROCESSING]: { label: "Processing", color: "#92400E", bg: "#FEF3C7" },
  [HearingStatus.COMPLETE]: { label: "Complete", color: "#065F46", bg: "#D1FAE5" },
  [HearingStatus.FAILED]: { label: "Failed", color: "#991B1B", bg: "#FEE2E2" },
  [HearingStatus.POSTPONED]: { label: "Postponed", color: "#6B7280", bg: "#E5E7EB" },
  [HearingStatus.CANCELED]: { label: "Canceled", color: "#6B7280", bg: "#E5E7EB" },
};

export function StatusBadge({ status }: { status: HearingStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[HearingStatus.DETECTED];

  return (
    <span
      className="inline-block px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide font-heading"
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderRadius: "20px",
        letterSpacing: "0.03em",
      }}
    >
      {config.label}
    </span>
  );
}
