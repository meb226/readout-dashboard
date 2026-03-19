/**
 * Mockup B: Hybrid Table layout.
 * PitchSource's firm-table-hybrid — spaced rows with rounded corners,
 * subtle shadows on hover, professional data density.
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

function TableRow({
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
    <tr
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer transition-all duration-200"
      style={{
        background: isSelected ? "rgba(0, 57, 166, 0.04)" : "white",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Committee */}
      <td
        className="py-4 px-4 text-xs font-semibold font-heading"
        style={{
          color: chamberColor,
          borderTop: "1px solid #E0E0E0",
          borderBottom: "1px solid #E0E0E0",
          borderLeft: isSelected ? `3px solid ${chamberColor}` : "1px solid #E0E0E0",
          borderRadius: "8px 0 0 8px",
          verticalAlign: "middle",
          whiteSpace: "nowrap",
        }}
      >
        {hearing.committee_name.length > 20 ? hearing.committee_name.slice(0, 20) + "..." : hearing.committee_name}
      </td>

      {/* Title */}
      <td
        className="py-4 px-4 text-sm text-text"
        style={{
          borderTop: "1px solid #E0E0E0",
          borderBottom: "1px solid #E0E0E0",
          verticalAlign: "middle",
          maxWidth: "400px",
        }}
      >
        <span className="line-clamp-1">{hearing.title}</span>
      </td>

      {/* Date */}
      <td
        className="py-4 px-4 text-xs text-text-muted"
        style={{
          borderTop: "1px solid #E0E0E0",
          borderBottom: "1px solid #E0E0E0",
          verticalAlign: "middle",
          whiteSpace: "nowrap",
        }}
      >
        {formatDate(hearing.hearing_date)}
      </td>

      {/* Status */}
      <td
        className="py-4 px-4"
        style={{
          borderTop: "1px solid #E0E0E0",
          borderBottom: "1px solid #E0E0E0",
          verticalAlign: "middle",
        }}
      >
        <StatusBadge status={hearing.status} />
      </td>

      {/* Actions */}
      <td
        className="py-4 px-4"
        style={{
          borderTop: "1px solid #E0E0E0",
          borderBottom: "1px solid #E0E0E0",
          borderRight: "1px solid #E0E0E0",
          borderRadius: "0 8px 8px 0",
          verticalAlign: "middle",
        }}
      >
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <ProcessButton eventId={hearing.event_id} status={hearing.status} />
          {isComplete && hearing.hearing_id && (
            <>
              <a
                href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
                target="_blank"
                rel="noopener"
                className="px-2 py-1 text-[11px] font-semibold rounded-md font-heading transition-all"
                style={{
                  background: "linear-gradient(135deg, #0039A6, #002d85)",
                  color: "white",
                }}
              >
                Brief
              </a>
              <a
                href={artifactUrl(hearing.event_id, "briefs/generic/podcast_episode.mp3")}
                target="_blank"
                rel="noopener"
                className="px-2 py-1 text-[11px] font-semibold rounded-md font-heading transition-all"
                style={{
                  background: "linear-gradient(135deg, #72A375, #5a8a5d)",
                  color: "white",
                }}
              >
                Pod
              </a>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function HearingTable({ committeeId, selectedEventId, onSelectHearing }: Props) {
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
      <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 6px" }}>
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-[11px] font-semibold text-text-faint uppercase tracking-wider font-heading">Committee</th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold text-text-faint uppercase tracking-wider font-heading">Title</th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold text-text-faint uppercase tracking-wider font-heading">Date</th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold text-text-faint uppercase tracking-wider font-heading">Status</th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold text-text-faint uppercase tracking-wider font-heading">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.hearings.map((h) => (
            <TableRow
              key={h.event_id}
              hearing={h}
              isSelected={selectedEventId === h.event_id}
              onSelect={onSelectHearing}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
