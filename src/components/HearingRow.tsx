/**
 * Mockup C: Dense List (polished with PitchSource styling).
 * Flat rows with better typography, gradient buttons, PitchSource transitions.
 */

import type { HearingListItem } from "../types/api";
import { HearingStatus } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { ProcessButton } from "./ProcessButton";
import { artifactUrl } from "../api/client";

interface HearingRowProps {
  hearing: HearingListItem;
  isSelected: boolean;
  onSelect: (eventId: string) => void;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function HearingRow({ hearing, isSelected, onSelect }: HearingRowProps) {
  const isComplete = hearing.status === HearingStatus.COMPLETE;
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#C0452A";

  return (
    <div
      className="mx-4 mb-1.5 cursor-pointer transition-all duration-200 rounded-lg"
      onClick={() => onSelect(hearing.event_id)}
      style={{
        background: isSelected ? "rgba(0, 57, 166, 0.04)" : "white",
        border: isSelected ? "1px solid rgba(0, 57, 166, 0.2)" : "1px solid #E0E0E0",
        padding: "14px 16px",
        boxShadow: isSelected ? "0 2px 8px rgba(0,57,166,0.08)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
          e.currentTarget.style.borderColor = "#ccc";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.borderColor = "#E0E0E0";
        }
      }}
    >
      {/* Top row: committee, date, status */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold font-heading" style={{ color: chamberColor }}>
            {hearing.committee_name.length > 30 ? hearing.committee_name.slice(0, 30) + "..." : hearing.committee_name}
          </span>
          <span className="text-[11px] text-text-faint">{formatDate(hearing.hearing_date)}</span>
        </div>
        <StatusBadge status={hearing.status} />
      </div>

      {/* Title */}
      <p className="text-[13px] text-text leading-snug mb-2 line-clamp-2">{hearing.title}</p>

      {/* Actions row */}
      <div className="flex items-center gap-2">
        <ProcessButton eventId={hearing.event_id} status={hearing.status} />

        {isComplete && hearing.hearing_id && (
          <>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all font-heading"
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
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all font-heading"
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

        {hearing.congress_gov_url && (
          <a
            href={hearing.congress_gov_url}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-[11px] text-text-faint hover:text-navy transition-colors"
          >
            Congress.gov
          </a>
        )}
      </div>
    </div>
  );
}
