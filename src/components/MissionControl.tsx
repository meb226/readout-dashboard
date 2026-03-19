/**
 * "Mission Control" — Linear-inspired dark glass command center.
 *
 * Dark background, frosted glass panels, live status feed,
 * spatial layout. DC situation room aesthetic.
 */

import { useHearings } from "../hooks/useHearings";
import { useStats } from "../hooks/useStats";
import { useCommittees } from "../hooks/useCommittees";
import { HearingStatus } from "../types/api";
import type { HearingListItem } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { ProcessButton } from "./ProcessButton";
import { artifactUrl } from "../api/client";

interface Props {
  onSelectHearing: (eventId: string) => void;
  selectedEventId: string | null;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function GlassCard({
  hearing,
  onSelect,
  isSelected,
}: {
  hearing: HearingListItem;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  const isComplete = hearing.status === HearingStatus.COMPLETE;
  const isActionable = hearing.status === HearingStatus.READY || hearing.status === HearingStatus.PREPARING || hearing.status === HearingStatus.PROCESSING;

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer rounded-lg transition-all duration-200 group"
      style={{
        background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
        border: isSelected ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.05)",
        padding: "16px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)";
        e.currentTarget.style.borderColor = isSelected ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-heading" style={{ color: hearing.committee_id.startsWith("senate") ? "#6ea8d9" : "#d98a8a" }}>
          {hearing.committee_name.length > 28 ? hearing.committee_name.slice(0, 28) + "..." : hearing.committee_name}
        </span>
        <StatusBadge status={hearing.status} />
      </div>

      <p className="text-sm text-white/80 leading-snug mb-3 group-hover:text-white transition-colors">
        {hearing.title}
      </p>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11px] text-white/25">{formatDate(hearing.hearing_date)}</span>
        <span className="flex-1" />
        {isActionable && <ProcessButton eventId={hearing.event_id} status={hearing.status} />}
        {isComplete && hearing.hearing_id && (
          <>
            <a href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
              target="_blank" rel="noopener"
              className="text-[11px] font-semibold text-[#6ea8d9] hover:text-white transition-colors font-heading">
              Brief
            </a>
            <a href={artifactUrl(hearing.event_id, "briefs/generic/podcast_episode.mp3")}
              target="_blank" rel="noopener"
              className="text-[11px] font-semibold text-[#8FCF92] hover:text-white transition-colors font-heading">
              Podcast
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function MissionControl({ onSelectHearing, selectedEventId }: Props) {
  const { data: stats } = useStats();
  const { data: committees } = useCommittees();
  const { data } = useHearings({ limit: 200 });

  const hearings = data?.hearings ?? [];
  const ready = hearings.filter((h) => h.status === HearingStatus.READY);
  const complete = hearings.filter((h) => h.status === HearingStatus.COMPLETE);
  const inProgress = hearings.filter(
    (h) => h.status === HearingStatus.PREPARING || h.status === HearingStatus.PROCESSING
  );
  const pipeline = hearings.filter(
    (h) => ![HearingStatus.READY, HearingStatus.COMPLETE, HearingStatus.PREPARING, HearingStatus.PROCESSING].includes(h.status)
  );

  return (
    <div className="min-h-screen" style={{ background: "#09090b" }}>
      {/* Top bar */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-4">
          <h1 className="font-brand text-lg font-extrabold tracking-tight">
            <span style={{ color: "#6ea8d9" }}>Read</span><span style={{ color: "#8FCF92" }}>out</span>
          </h1>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded font-heading"
            style={{ background: "rgba(110,168,217,0.1)", color: "#6ea8d9" }}>
            Beta
          </span>
        </div>

        {/* Live stats */}
        {stats && (
          <div className="flex items-center gap-5">
            {[
              { label: "Ready", value: stats.ready_count, color: "#6ea8d9" },
              { label: "Active", value: stats.preparing_count + stats.processing_count, color: "#d4a843" },
              { label: "Done", value: stats.complete_count, color: "#8FCF92" },
              { label: "Total", value: stats.total_hearings, color: "rgba(255,255,255,0.25)" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-lg font-extrabold font-heading" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-widest font-heading" style={{ color: `${s.color}80` }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Main grid: 3-column spatial layout */}
      <div className="grid grid-cols-[300px_1fr_300px] gap-0 min-h-[calc(100vh-60px)]">

        {/* Left: Activity feed */}
        <aside className="p-4 overflow-y-auto" style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 font-heading" style={{ color: "rgba(255,255,255,0.2)" }}>
            Live Activity
          </h3>
          <div className="space-y-1">
            {inProgress.slice(0, 15).map((h) => (
              <div
                key={h.event_id}
                className="px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-white/3"
                onClick={() => onSelectHearing(h.event_id)}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a843] animate-pulse" />
                  <span className="text-[10px] text-white/30 font-heading">{formatDate(h.hearing_date)}</span>
                </div>
                <p className="text-xs text-white/50 leading-snug">{h.title.length > 60 ? h.title.slice(0, 60) + "..." : h.title}</p>
              </div>
            ))}
            {inProgress.length === 0 && (
              <p className="text-xs text-white/15 px-3">No active processing</p>
            )}

            <h3 className="text-[10px] font-bold uppercase tracking-widest mt-6 mb-3 font-heading" style={{ color: "rgba(255,255,255,0.2)" }}>
              Pipeline ({pipeline.length})
            </h3>
            {pipeline.slice(0, 10).map((h) => (
              <div
                key={h.event_id}
                className="px-3 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-white/3"
                onClick={() => onSelectHearing(h.event_id)}
              >
                <p className="text-[11px] text-white/25 leading-snug truncate">{h.title}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Main hearings */}
        <main className="p-6 overflow-y-auto">
          {/* Action Required */}
          {ready.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-3 rounded-full bg-[#6ea8d9]" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#6ea8d9] font-heading">
                  Action Required
                </h2>
                <span className="text-[11px] text-white/20">{ready.length}</span>
              </div>
              <div className="space-y-2">
                {ready.map((h) => (
                  <GlassCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
                ))}
              </div>
            </section>
          )}

          {/* In Progress */}
          {inProgress.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-3 rounded-full bg-[#d4a843]" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#d4a843] font-heading">
                  Processing
                </h2>
                <span className="text-[11px] text-white/20">{inProgress.length}</span>
              </div>
              <div className="space-y-2">
                {inProgress.slice(0, 6).map((h) => (
                  <GlassCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
                ))}
              </div>
            </section>
          )}

          {/* Complete */}
          {complete.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-3 rounded-full bg-[#8FCF92]" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#8FCF92] font-heading">
                  Completed
                </h2>
                <span className="text-[11px] text-white/20">{complete.length}</span>
              </div>
              <div className="space-y-2">
                {complete.map((h) => (
                  <GlassCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Right: Committees */}
        <aside className="p-4 overflow-y-auto" style={{ borderLeft: "1px solid rgba(255,255,255,0.04)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 font-heading" style={{ color: "rgba(255,255,255,0.2)" }}>
            Committees
          </h3>
          <div className="space-y-1">
            {committees?.map((c) => (
              <div
                key={c.committee_id}
                className="px-3 py-2.5 rounded-md transition-colors hover:bg-white/3 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full"
                    style={{ background: c.chamber === "senate" ? "#6ea8d9" : "#d98a8a" }} />
                  <span className="text-sm text-white/50 font-heading">{c.short_name}</span>
                </div>
                <span className="text-xs text-white/15">{c.member_count}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
