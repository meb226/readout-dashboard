/**
 * ML-65: Full dashboard view — status-grouped sections, not a flat list.
 *
 * Layout:
 *   - Stats ribbon at top (big numbers)
 *   - "Action Required" section (ready hearings — these need user clicks)
 *   - "In Progress" section (preparing + processing)
 *   - "Recently Completed" section (deliverables ready to consume)
 *   - "Upcoming" section (detected/resolved — pipeline is working on these)
 */

import { useHearings } from "../hooks/useHearings";
import { useStats } from "../hooks/useStats";
import { HearingStatus } from "../types/api";
import type { HearingListItem } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { ProcessButton } from "./ProcessButton";
import { artifactUrl } from "../api/client";

interface DashboardProps {
  committeeId: string | null;
  selectedEventId: string | null;
  onSelectHearing: (eventId: string) => void;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Stats Ribbon ──────────────────────────────────────────────────

function StatsRibbon() {
  const { data: stats } = useStats();
  if (!stats) return null;

  const items = [
    { label: "Ready", value: stats.ready_count, color: "#0039A6", bg: "rgba(0,57,166,0.06)" },
    { label: "Processing", value: stats.preparing_count + stats.processing_count, color: "#B8860B", bg: "rgba(184,134,11,0.06)" },
    { label: "Complete", value: stats.complete_count, color: "#065F46", bg: "rgba(114,163,117,0.08)" },
    { label: "Failed", value: stats.failed_count, color: "#991B1B", bg: stats.failed_count > 0 ? "rgba(192,69,42,0.06)" : "transparent" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl px-5 py-4 transition-all duration-200"
          style={{
            background: item.bg,
            border: `1px solid ${item.color}15`,
          }}
        >
          <p className="text-3xl font-extrabold font-heading" style={{ color: item.color }}>
            {item.value}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider mt-1 font-heading" style={{ color: item.color, opacity: 0.7 }}>
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 mb-4 mt-8">
      <div className="w-1 h-5 rounded-full" style={{ background: color }} />
      <h2 className="text-sm font-bold uppercase tracking-wider font-heading" style={{ color }}>
        {title}
      </h2>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full font-heading"
        style={{ color, background: `${color}12` }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Action Required Card (Ready hearings — big, prominent) ───────

function ActionCard({ hearing, onSelect }: { hearing: HearingListItem; onSelect: (id: string) => void }) {
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#C0452A";

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer rounded-xl p-5 transition-all duration-300"
      style={{
        background: "white",
        border: "1px solid #E0E0E0",
        boxShadow: "0 4px 16px rgba(0,57,166,0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,57,166,0.12)";
        e.currentTarget.style.borderColor = "#0039A6";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,57,166,0.06)";
        e.currentTarget.style.borderColor = "#E0E0E0";
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-semibold font-heading" style={{ color: chamberColor }}>
            {hearing.committee_name}
          </span>
          <span className="text-xs text-text-faint ml-2">{formatDate(hearing.hearing_date)}</span>
        </div>
        <StatusBadge status={hearing.status} />
      </div>

      <p className="text-base font-medium text-text leading-snug mb-4">{hearing.title}</p>

      <div onClick={(e) => e.stopPropagation()}>
        <ProcessButton eventId={hearing.event_id} status={hearing.status} />
      </div>
    </div>
  );
}

// ─── In Progress Card (preparing/processing — shows progress) ─────

function ProgressCard({ hearing, onSelect }: { hearing: HearingListItem; onSelect: (id: string) => void }) {
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#C0452A";

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer rounded-lg px-4 py-3 transition-all duration-200 flex items-center gap-4"
      style={{
        background: "white",
        border: "1px solid #E0E0E0",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-semibold font-heading" style={{ color: chamberColor }}>
            {hearing.committee_name.length > 25 ? hearing.committee_name.slice(0, 25) + "..." : hearing.committee_name}
          </span>
          <span className="text-[11px] text-text-faint">{formatDate(hearing.hearing_date)}</span>
        </div>
        <p className="text-sm text-text truncate">{hearing.title}</p>
      </div>
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <ProcessButton eventId={hearing.event_id} status={hearing.status} />
      </div>
      <StatusBadge status={hearing.status} />
    </div>
  );
}

// ─── Complete Card (deliverables available — show action buttons) ──

function CompleteCard({ hearing, onSelect }: { hearing: HearingListItem; onSelect: (id: string) => void }) {
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#C0452A";

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer rounded-xl p-5 transition-all duration-300"
      style={{
        background: "white",
        border: "1px solid #E0E0E0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderColor = "#72A375";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = "#E0E0E0";
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xs font-semibold font-heading" style={{ color: chamberColor }}>
            {hearing.committee_name}
          </span>
          <span className="text-xs text-text-faint ml-2">{formatDate(hearing.hearing_date)}</span>
        </div>
        <StatusBadge status={hearing.status} />
      </div>

      <p className="text-sm font-medium text-text leading-snug mb-4">{hearing.title}</p>

      {/* Deliverable buttons */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onSelect(hearing.event_id)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg font-heading transition-all"
          style={{
            background: "white",
            color: "#0039A6",
            border: "2px solid #E0E0E0",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#0039A6";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#E0E0E0";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          View Memo
        </button>
        {hearing.hearing_id && (
          <>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
              target="_blank"
              rel="noopener"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg font-heading transition-all"
              style={{
                background: "linear-gradient(135deg, #0039A6, #002d85)",
                color: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)";
              }}
            >
              Audio Brief
            </a>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/podcast_episode.mp3")}
              target="_blank"
              rel="noopener"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg font-heading transition-all"
              style={{
                background: "linear-gradient(135deg, #72A375, #5a8a5d)",
                color: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)";
              }}
            >
              Podcast
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Compact Row (detected/resolved — minimal, just tracking) ─────

function CompactRow({ hearing, onSelect }: { hearing: HearingListItem; onSelect: (id: string) => void }) {
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#C0452A";

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer px-4 py-2.5 flex items-center gap-3 transition-colors duration-150 rounded-md hover:bg-[#f5f5f5]"
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: chamberColor }} />
      <span className="text-[11px] font-semibold font-heading text-text-muted w-24 flex-shrink-0" style={{ color: chamberColor }}>
        {hearing.committee_name.length > 18 ? hearing.committee_name.slice(0, 18) + "..." : hearing.committee_name}
      </span>
      <span className="text-sm text-text truncate flex-1">{hearing.title}</span>
      <span className="text-[11px] text-text-faint flex-shrink-0">{formatDate(hearing.hearing_date)}</span>
      <StatusBadge status={hearing.status} />
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────

export function Dashboard({ committeeId, selectedEventId: _selectedEventId, onSelectHearing }: DashboardProps) {
  const { data, isLoading, error } = useHearings({
    committee_id: committeeId ?? undefined,
    limit: 200,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-text-muted animate-pulse">Loading hearings...</div>;
  }
  if (error) {
    return <div className="flex items-center justify-center h-64 text-red">Failed to load: {error.message}</div>;
  }

  const hearings = data?.hearings ?? [];

  // Group by status category
  const ready = hearings.filter((h) => h.status === HearingStatus.READY);
  const inProgress = hearings.filter(
    (h) => h.status === HearingStatus.PREPARING || h.status === HearingStatus.PROCESSING
  );
  const complete = hearings.filter((h) => h.status === HearingStatus.COMPLETE);
  const failed = hearings.filter((h) => h.status === HearingStatus.FAILED);
  const upcoming = hearings.filter(
    (h) => h.status === HearingStatus.DETECTED || h.status === HearingStatus.RESOLVED
  );
  const inactive = hearings.filter(
    (h) => h.status === HearingStatus.POSTPONED || h.status === HearingStatus.CANCELED
  );

  return (
    <div className="p-8 max-w-[1100px]">
      <StatsRibbon />

      {/* Action Required — prominent cards */}
      <SectionHeader title="Action Required" count={ready.length} color="#0039A6" />
      {ready.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ready.map((h) => (
            <ActionCard key={h.event_id} hearing={h} onSelect={onSelectHearing} />
          ))}
        </div>
      )}

      {/* In Progress — compact rows with progress */}
      <SectionHeader title="In Progress" count={inProgress.length} color="#B8860B" />
      {inProgress.length > 0 && (
        <div className="space-y-2">
          {inProgress.slice(0, 10).map((h) => (
            <ProgressCard key={h.event_id} hearing={h} onSelect={onSelectHearing} />
          ))}
          {inProgress.length > 10 && (
            <p className="text-xs text-text-faint pl-4 pt-1">
              + {inProgress.length - 10} more preparing...
            </p>
          )}
        </div>
      )}

      {/* Recently Completed — cards with deliverable buttons */}
      <SectionHeader title="Recently Completed" count={complete.length} color="#065F46" />
      {complete.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {complete.map((h) => (
            <CompleteCard key={h.event_id} hearing={h} onSelect={onSelectHearing} />
          ))}
        </div>
      )}

      {/* Failed — needs attention */}
      <SectionHeader title="Failed" count={failed.length} color="#991B1B" />
      {failed.length > 0 && (
        <div className="space-y-1">
          {failed.map((h) => (
            <CompactRow key={h.event_id} hearing={h} onSelect={onSelectHearing} />
          ))}
        </div>
      )}

      {/* Upcoming — compact list, just tracking */}
      <SectionHeader title="In Pipeline" count={upcoming.length} color="#6B7280" />
      {upcoming.length > 0 && (
        <div className="rounded-lg border border-border bg-white">
          {upcoming.slice(0, 15).map((h) => (
            <CompactRow key={h.event_id} hearing={h} onSelect={onSelectHearing} />
          ))}
          {upcoming.length > 15 && (
            <p className="text-xs text-text-faint px-4 py-2 border-t border-border">
              + {upcoming.length - 15} more in pipeline...
            </p>
          )}
        </div>
      )}

      {/* Postponed/Canceled — collapsed */}
      {inactive.length > 0 && (
        <>
          <SectionHeader title="Postponed / Canceled" count={inactive.length} color="#9CA3AF" />
          <div className="rounded-lg border border-border bg-white">
            {inactive.slice(0, 5).map((h) => (
              <CompactRow key={h.event_id} hearing={h} onSelect={onSelectHearing} />
            ))}
            {inactive.length > 5 && (
              <p className="text-xs text-text-faint px-4 py-2 border-t border-border">
                + {inactive.length - 5} more...
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
