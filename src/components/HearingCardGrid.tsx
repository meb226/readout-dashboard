/**
 * Mockup A: Card Grid layout.
 * Each hearing is a glassmorphism card in a responsive grid.
 * PitchSource-style: backdrop blur, subtle border, hover elevation.
 */

import type { HearingListItem } from "../types/api";
import { HearingStatus } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { ProcessButton } from "./ProcessButton";
import { artifactUrl } from "../api/client";
import { useHearings } from "../hooks/useHearings";

interface Props {
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

function HearingCard({
  hearing,
  isSelected,
  onSelect,
}: {
  hearing: HearingListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const isComplete = hearing.status === HearingStatus.COMPLETE;
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#C0452A";

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer transition-all duration-300"
      style={{
        background: isSelected ? "rgba(0, 57, 166, 0.06)" : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(20px)",
        border: isSelected ? "1px solid rgba(0, 57, 166, 0.3)" : "1px solid rgba(255, 255, 255, 0.8)",
        borderRadius: "10px",
        padding: "20px",
        boxShadow: "0 4px 16px rgba(2, 52, 68, 0.08), 0 2px 4px rgba(2, 52, 68, 0.04)",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(2, 52, 68, 0.12), 0 4px 8px rgba(2, 52, 68, 0.08)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(2, 52, 68, 0.08), 0 2px 4px rgba(2, 52, 68, 0.04)";
      }}
    >
      {/* Committee banner */}
      <div
        className="text-white text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-md mb-3 inline-block font-heading"
        style={{ background: chamberColor }}
      >
        {hearing.committee_name.length > 25 ? hearing.committee_name.slice(0, 25) + "..." : hearing.committee_name}
      </div>

      {/* Date + Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted">{formatDate(hearing.hearing_date)}</span>
        <StatusBadge status={hearing.status} />
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-text leading-snug mb-3 line-clamp-2">{hearing.title}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        <ProcessButton eventId={hearing.event_id} status={hearing.status} />
        {isComplete && hearing.hearing_id && (
          <>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all font-heading"
              style={{
                background: "linear-gradient(135deg, #0039A6, #002d85)",
                color: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              Brief
            </a>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/podcast_episode.mp3")}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all font-heading"
              style={{
                background: "linear-gradient(135deg, #72A375, #5a8a5d)",
                color: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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

export function HearingCardGrid({ committeeId, selectedEventId, onSelectHearing }: Props) {
  const { data, isLoading, error } = useHearings({
    committee_id: committeeId ?? undefined,
    limit: 100,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-text-muted animate-pulse">Loading hearings...</div>;
  }
  if (error) {
    return <div className="flex items-center justify-center h-64 text-red">Failed to load: {error.message}</div>;
  }
  if (!data?.hearings.length) {
    return <div className="flex items-center justify-center h-64 text-text-muted">No hearings found.</div>;
  }

  return (
    <div className="p-6">
      <p className="text-xs text-text-muted font-heading mb-4">{data.total} hearings</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.hearings.map((h) => (
          <HearingCard
            key={h.event_id}
            hearing={h}
            isSelected={selectedEventId === h.event_id}
            onSelect={onSelectHearing}
          />
        ))}
      </div>
    </div>
  );
}
