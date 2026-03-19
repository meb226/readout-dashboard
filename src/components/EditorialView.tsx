/**
 * "The Briefing" — Editorial/newsroom layout.
 *
 * Hearing titles are bold headlines, committees are beats,
 * completed briefs displayed like published articles.
 * Bloomberg Terminal meets The Verge.
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
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function Headline({ hearing, onSelect, size }: { hearing: HearingListItem; onSelect: (id: string) => void; size: "lg" | "md" | "sm" }) {
  const isComplete = hearing.status === HearingStatus.COMPLETE;
  const isReady = hearing.status === HearingStatus.READY;
  const isActive = hearing.status === HearingStatus.PREPARING || hearing.status === HearingStatus.PROCESSING;
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#8B1A1A";

  const titleClass = size === "lg"
    ? "text-2xl md:text-3xl font-extrabold leading-tight font-heading"
    : size === "md"
      ? "text-lg font-bold leading-snug font-heading"
      : "text-base font-semibold leading-snug font-heading";

  return (
    <article
      className="group cursor-pointer"
      onClick={() => onSelect(hearing.event_id)}
    >
      {/* Byline */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wider font-heading" style={{ color: chamberColor }}>
          {hearing.committee_name}
        </span>
        <span className="text-xs text-[#999]">&middot;</span>
        <span className="text-xs text-[#999]">{formatDate(hearing.hearing_date)}</span>
        <StatusBadge status={hearing.status} />
      </div>

      {/* Headline */}
      <h2
        className={`${titleClass} text-[#111] mb-3 group-hover:text-[#0039A6] transition-colors duration-200`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {hearing.title}
      </h2>

      {/* Actions */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {(isReady || isActive) && <ProcessButton eventId={hearing.event_id} status={hearing.status} />}
        {isComplete && hearing.hearing_id && (
          <>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
              target="_blank" rel="noopener"
              className="text-xs font-semibold text-[#0039A6] hover:underline font-heading"
            >
              Listen to Brief
            </a>
            <span className="text-[#ddd]">&middot;</span>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/podcast_episode.mp3")}
              target="_blank" rel="noopener"
              className="text-xs font-semibold text-[#72A375] hover:underline font-heading"
            >
              Full Podcast
            </a>
            <span className="text-[#ddd]">&middot;</span>
            <button
              onClick={() => onSelect(hearing.event_id)}
              className="text-xs font-semibold text-[#666] hover:text-[#111] font-heading"
            >
              Read Memo
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function EditorialView({ onSelectHearing, selectedEventId }: Props) {
  const { data: stats } = useStats();
  const { data: committees } = useCommittees();
  const { data } = useHearings({ limit: 200 });

  const hearings = data?.hearings ?? [];
  const ready = hearings.filter((h) => h.status === HearingStatus.READY);
  const complete = hearings.filter((h) => h.status === HearingStatus.COMPLETE);
  const inProgress = hearings.filter(
    (h) => h.status === HearingStatus.PREPARING || h.status === HearingStatus.PROCESSING
  );
  const rest = hearings.filter(
    (h) => ![HearingStatus.READY, HearingStatus.COMPLETE, HearingStatus.PREPARING, HearingStatus.PROCESSING].includes(h.status)
  );

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF9" }}>
      {/* Masthead */}
      <header className="border-b-2 border-[#111] px-8 md:px-16 py-6">
        <div className="max-w-[1200px] mx-auto flex items-end justify-between">
          <div>
            <h1 className="font-brand text-4xl font-extrabold tracking-tighter">
              <span style={{ color: "#0039A6" }}>Read</span><span style={{ color: "#72A375" }}>out</span>
            </h1>
            <p className="text-xs text-[#999] font-heading mt-1 uppercase tracking-widest">Congressional Hearing Intelligence</p>
          </div>
          {stats && (
            <div className="text-right">
              <p className="text-xs text-[#999] font-heading">
                {stats.total_hearings} hearings across {committees?.length ?? 0} committees
              </p>
              <p className="text-xs font-heading mt-0.5">
                <span className="text-[#0039A6] font-bold">{stats.ready_count} ready</span>
                <span className="text-[#999] mx-2">&middot;</span>
                <span className="text-[#B8860B] font-bold">{stats.preparing_count + stats.processing_count} processing</span>
                <span className="text-[#999] mx-2">&middot;</span>
                <span className="text-[#72A375] font-bold">{stats.complete_count} complete</span>
              </p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-8 md:px-16 py-10">
        {/* Lead story — first ready or complete hearing */}
        {(ready.length > 0 || complete.length > 0) && (
          <div className="mb-12 pb-10 border-b border-[#e0e0e0]">
            <Headline
              hearing={ready[0] ?? complete[0]}
              onSelect={onSelectHearing}
              size="lg"
            />
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-12">
          {/* Main column */}
          <div>
            {/* Action Required */}
            {ready.length > 1 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-5 pb-2 border-b border-[#e0e0e0]">
                  <div className="w-3 h-3 rounded-sm bg-[#0039A6]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0039A6] font-heading">Action Required</h3>
                </div>
                <div className="space-y-8">
                  {ready.slice(1).map((h) => (
                    <Headline key={h.event_id} hearing={h} onSelect={onSelectHearing} size="md" />
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {complete.length > (ready.length > 0 ? 0 : 1) && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-5 pb-2 border-b border-[#e0e0e0]">
                  <div className="w-3 h-3 rounded-sm bg-[#72A375]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#72A375] font-heading">Briefings Ready</h3>
                </div>
                <div className="space-y-8">
                  {complete.slice(ready.length > 0 ? 0 : 1).map((h) => (
                    <Headline key={h.event_id} hearing={h} onSelect={onSelectHearing} size="md" />
                  ))}
                </div>
              </section>
            )}

            {/* In progress */}
            {inProgress.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-5 pb-2 border-b border-[#e0e0e0]">
                  <div className="w-3 h-3 rounded-sm bg-[#B8860B]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#B8860B] font-heading">Processing</h3>
                </div>
                <div className="space-y-6">
                  {inProgress.slice(0, 8).map((h) => (
                    <Headline key={h.event_id} hearing={h} onSelect={onSelectHearing} size="sm" />
                  ))}
                  {inProgress.length > 8 && (
                    <p className="text-xs text-[#999]">+ {inProgress.length - 8} more in progress</p>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar — Pipeline ticker */}
          <aside className="border-l border-[#e0e0e0] pl-8">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#999] mb-4 font-heading">Pipeline</h3>
            <div className="space-y-4">
              {rest.slice(0, 20).map((h) => (
                <div
                  key={h.event_id}
                  className="cursor-pointer group"
                  onClick={() => onSelectHearing(h.event_id)}
                >
                  <p className="text-xs text-[#999] font-heading">
                    <span style={{ color: h.committee_id.startsWith("senate") ? "#0039A6" : "#8B1A1A" }}>
                      {h.committee_name.length > 20 ? h.committee_name.slice(0, 20) + "..." : h.committee_name}
                    </span>
                    {" "}&middot; {formatDate(h.hearing_date)}
                  </p>
                  <p className="text-sm text-[#444] group-hover:text-[#0039A6] transition-colors leading-snug">
                    {h.title.length > 80 ? h.title.slice(0, 80) + "..." : h.title}
                  </p>
                </div>
              ))}
              {rest.length > 20 && (
                <p className="text-xs text-[#ccc]">+ {rest.length - 20} more</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
