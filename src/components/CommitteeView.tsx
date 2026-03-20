/**
 * ML-65: Committee-first dashboard.
 *
 * Two states:
 *   1. No committee selected → Senate column | House column of committee cards
 *   2. Committee selected → committee card shrinks to sidebar, hearings fill main area
 *
 * Visual: light water-blue-to-green gradient background, frosted glass cards.
 */

import { useState } from "react";
import { useCommittees } from "../hooks/useCommittees";
import { useStats } from "../hooks/useStats";
import { useHearings } from "../hooks/useHearings";
import { useHearingDetail } from "../hooks/useHearingDetail";
import { HearingStatus } from "../types/api";
import type { HearingListItem, CommitteeInfo } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { ProcessButton } from "./ProcessButton";
import { artifactUrl } from "../api/client";

// ─── Theme constants ──────────────────────────────────────────────

const BG_GRADIENT = "linear-gradient(135deg, #dce9f3 0%, #e8f0ec 50%, #dff0e4 100%)";
const BG_DRILLED = "linear-gradient(135deg, #e0eaf2 0%, #eaf3ee 50%, #e3f2e7 100%)";
const SIDEBAR_BG = "linear-gradient(180deg, #f0f5f9 0%, #f4f8f5 100%)";

function chamberGradient(chamber: string): string {
  if (chamber === "senate") return "linear-gradient(135deg, #0039A6 0%, #1a5bbf 100%)";
  if (chamber === "house") return "linear-gradient(135deg, #8B1A1A 0%, #a83232 100%)";
  return "linear-gradient(135deg, #4A4A4A 0%, #666 100%)";
}

function chamberAccent(chamber: string): string {
  if (chamber === "senate") return "#0039A6";
  if (chamber === "house") return "#8B1A1A";
  return "#666";
}

export function chamberLight(chamber: string): string {
  if (chamber === "senate") return "rgba(0, 57, 166, 0.06)";
  if (chamber === "house") return "rgba(139, 26, 26, 0.06)";
  return "rgba(0,0,0,0.03)";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Committee Card (landing page) ────────────────────────────────

function CommitteeCard({
  committee,
  count,
  onClick,
}: {
  committee: CommitteeInfo;
  count: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-2xl p-5 transition-all duration-300 relative overflow-hidden group"
      style={{
        background: chamberGradient(committee.chamber),
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)";
      }}
    >
      {/* Glow */}
      <div
        className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: "white" }}
      />

      <h3 className="text-base font-bold text-white font-heading leading-tight mb-0.5">
        {committee.short_name}
      </h3>
      <p className="text-[11px] text-white/50 font-heading mb-3">
        {committee.member_count} members
      </p>

      <div className="flex items-center gap-2">
        <span className="text-xl font-extrabold text-white font-heading">{count}</span>
        <span className="text-[11px] text-white/40">hearings</span>
      </div>
    </div>
  );
}

// ─── Sidebar committee list (drilled-in state) ───────────────────

function CommitteeSidebar({
  committee,
  count,
  onBack,
  allCommittees,
  allCounts,
  onSwitch,
}: {
  committee: CommitteeInfo;
  count: number;
  onBack: () => void;
  allCommittees: CommitteeInfo[];
  allCounts: Map<string, number>;
  onSwitch: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto border-r border-black/5" style={{ background: SIDEBAR_BG }}>
      {/* Back */}
      <button
        onClick={onBack}
        className="w-full text-left px-5 py-3 text-xs font-semibold text-text-muted hover:text-text transition-colors font-heading flex items-center gap-2"
      >
        <span>&larr;</span> All Committees
      </button>

      {/* Active */}
      <div className="mx-3 mb-4 rounded-xl p-4 relative overflow-hidden" style={{ background: chamberGradient(committee.chamber) }}>
        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 blur-xl" style={{ background: "white" }} />
        <h3 className="text-sm font-bold text-white font-heading">{committee.short_name}</h3>
        <p className="text-[11px] text-white/50 mt-0.5">{count} hearings</p>
      </div>

      {/* Others */}
      <div className="px-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-faint px-2 mb-2 font-heading">
          Switch
        </p>
        {allCommittees
          .filter((c) => c.committee_id !== committee.committee_id)
          .map((c) => (
            <button
              key={c.committee_id}
              onClick={() => onSwitch(c.committee_id)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-black/3 transition-all font-heading flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: chamberAccent(c.chamber) }} />
                <span className="truncate">{c.short_name}</span>
              </span>
              <span className="text-xs text-text-faint">{allCounts.get(c.committee_id) ?? 0}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

// ─── Hearing Card (inside committee — light theme) ───────────────

function HearingCard({
  hearing,
  onSelect,
  isSelected,
}: {
  hearing: HearingListItem;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  const isComplete = hearing.status === HearingStatus.COMPLETE;
  const isReady = hearing.status === HearingStatus.READY;
  const isActive = hearing.status === HearingStatus.PREPARING || hearing.status === HearingStatus.PROCESSING;

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer rounded-xl transition-all duration-300"
      style={{
        background: isSelected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        border: isSelected ? "1px solid rgba(0,57,166,0.25)" : "1px solid rgba(255,255,255,0.6)",
        padding: "20px",
        boxShadow: isSelected
          ? "0 4px 20px rgba(0,57,166,0.1)"
          : "0 2px 12px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.92)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isSelected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = isSelected
          ? "0 4px 20px rgba(0,57,166,0.1)"
          : "0 2px 12px rgba(0,0,0,0.04)";
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-faint">{formatDate(hearing.hearing_date)}</span>
        <StatusBadge status={hearing.status} />
      </div>

      <p className="text-sm font-medium text-text leading-snug mb-4">{hearing.title}</p>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {(isReady || isActive) && <ProcessButton eventId={hearing.event_id} status={hearing.status} />}

        {isComplete && hearing.hearing_id && (
          <>
            <button
              onClick={() => onSelect(hearing.event_id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg font-heading transition-all bg-white border-2 border-border text-navy hover:border-navy"
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Memo
            </button>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
              target="_blank" rel="noopener"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg font-heading transition-all text-white"
              style={{ background: "linear-gradient(135deg, #0039A6, #1a5bbf)", boxShadow: "0 2px 8px rgba(0,57,166,0.2)" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Brief
            </a>
            <a
              href={artifactUrl(hearing.event_id, "briefs/generic/podcast_episode.mp3")}
              target="_blank" rel="noopener"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg font-heading transition-all text-white"
              style={{ background: "linear-gradient(135deg, #72A375, #5a8a5d)", boxShadow: "0 2px 8px rgba(114,163,117,0.2)" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Podcast
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

interface CommitteeViewProps {
  onSelectHearing: (eventId: string) => void;
  selectedEventId: string | null;
}

export function CommitteeView({ onSelectHearing, selectedEventId }: CommitteeViewProps) {
  const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
  const { data: committees } = useCommittees();
  const { data: stats } = useStats();
  const { data: hearingsData } = useHearings({
    committee_id: activeCommittee ?? undefined,
    limit: 200,
  });

  const countMap = new Map<string, number>();
  if (stats) {
    for (const c of stats.by_committee) {
      countMap.set(c.committee_id, c.count);
    }
  }

  // Split committees by chamber
  const senateCommittees = committees?.filter((c) => c.chamber === "senate") ?? [];
  const houseCommittees = committees?.filter((c) => c.chamber === "house") ?? [];

  // ─── Landing: Senate | House columns ────────────────────────

  if (!activeCommittee) {
    return (
      <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
        {/* Header */}
        <div className="px-10 pt-10 pb-6">
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="font-brand text-2xl font-extrabold tracking-tight">
              <span className="text-navy">Read</span>
              <span className="text-green">out</span>
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded font-heading bg-navy-light text-navy">
              Beta
            </span>
          </div>
          <p className="text-sm text-text-muted font-heading">
            Congressional Hearing Intelligence
          </p>

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-5 mt-6">
              <div className="px-4 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/80">
                <span className="text-2xl font-extrabold text-text font-heading">{stats.total_hearings}</span>
                <span className="text-xs text-text-muted ml-2">tracked</span>
              </div>
              {stats.ready_count > 0 && (
                <div className="px-4 py-2 rounded-xl" style={{ background: "rgba(0,57,166,0.08)" }}>
                  <span className="text-lg font-bold font-heading text-navy">{stats.ready_count}</span>
                  <span className="text-xs text-text-muted ml-1.5">ready</span>
                </div>
              )}
              {stats.complete_count > 0 && (
                <div className="px-4 py-2 rounded-xl" style={{ background: "rgba(114,163,117,0.1)" }}>
                  <span className="text-lg font-bold font-heading text-green">{stats.complete_count}</span>
                  <span className="text-xs text-text-muted ml-1.5">complete</span>
                </div>
              )}
              <div className="px-4 py-2 rounded-xl" style={{ background: "rgba(184,134,11,0.06)" }}>
                <span className="text-lg font-bold font-heading" style={{ color: "#B8860B" }}>
                  {stats.preparing_count + stats.processing_count}
                </span>
                <span className="text-xs text-text-muted ml-1.5">processing</span>
              </div>
            </div>
          )}
        </div>

        {/* Two-column: Senate | House */}
        <div className="px-10 pb-10 grid grid-cols-2 gap-10">
          {/* Senate column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 rounded-full bg-navy" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-navy font-heading">Senate</h2>
              <span className="text-xs text-text-faint">{senateCommittees.length} committees</span>
            </div>
            <div className="space-y-3">
              {senateCommittees.map((c) => (
                <CommitteeCard
                  key={c.committee_id}
                  committee={c}
                  count={countMap.get(c.committee_id) ?? 0}
                  onClick={() => setActiveCommittee(c.committee_id)}
                />
              ))}
            </div>
          </div>

          {/* House column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ background: "#8B1A1A" }} />
              <h2 className="text-xs font-bold uppercase tracking-wider font-heading" style={{ color: "#8B1A1A" }}>House</h2>
              <span className="text-xs text-text-faint">{houseCommittees.length} committees</span>
            </div>
            <div className="space-y-3">
              {houseCommittees.map((c) => (
                <CommitteeCard
                  key={c.committee_id}
                  committee={c}
                  count={countMap.get(c.committee_id) ?? 0}
                  onClick={() => setActiveCommittee(c.committee_id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Drilled In: Sidebar + Hearings ─────────────────────────

  const activeCommitteeInfo = committees?.find((c) => c.committee_id === activeCommittee);
  const hearings = hearingsData?.hearings ?? [];

  const ready = hearings.filter((h) => h.status === HearingStatus.READY);
  const inProgress = hearings.filter(
    (h) => h.status === HearingStatus.PREPARING || h.status === HearingStatus.PROCESSING
  );
  const complete = hearings.filter((h) => h.status === HearingStatus.COMPLETE);
  const rest = hearings.filter(
    (h) =>
      h.status !== HearingStatus.READY &&
      h.status !== HearingStatus.PREPARING &&
      h.status !== HearingStatus.PROCESSING &&
      h.status !== HearingStatus.COMPLETE
  );

  return (
    <div
      className="min-h-screen grid"
      style={{
        gridTemplateColumns: selectedEventId ? "260px 1fr 420px" : "260px 1fr",
        background: BG_DRILLED,
      }}
    >
      {activeCommitteeInfo && (
        <CommitteeSidebar
          committee={activeCommitteeInfo}
          count={hearings.length}
          onBack={() => setActiveCommittee(null)}
          allCommittees={committees ?? []}
          allCounts={countMap}
          onSwitch={setActiveCommittee}
        />
      )}

      <main className="overflow-y-auto p-8">
        {ready.length > 0 && (
          <>
            <SectionLabel label="Action Required" count={ready.length} color="#0039A6" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {ready.map((h) => (
                <HearingCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
              ))}
            </div>
          </>
        )}

        {inProgress.length > 0 && (
          <>
            <SectionLabel label="In Progress" count={inProgress.length} color="#B8860B" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {inProgress.slice(0, 10).map((h) => (
                <HearingCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
              ))}
            </div>
            {inProgress.length > 10 && (
              <p className="text-xs text-text-faint mb-8">+ {inProgress.length - 10} more preparing...</p>
            )}
          </>
        )}

        {complete.length > 0 && (
          <>
            <SectionLabel label="Completed" count={complete.length} color="#72A375" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {complete.map((h) => (
                <HearingCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
              ))}
            </div>
          </>
        )}

        {rest.length > 0 && (
          <>
            <SectionLabel label="In Pipeline" count={rest.length} color="#999" />
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
              {rest.slice(0, 15).map((h) => (
                <HearingCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
              ))}
            </div>
            {rest.length > 15 && (
              <p className="text-xs text-text-faint">+ {rest.length - 15} more in pipeline...</p>
            )}
          </>
        )}

        {hearings.length === 0 && (
          <div className="flex items-center justify-center h-64 text-text-muted">
            No hearings for this committee yet.
          </div>
        )}
      </main>

      {selectedEventId && (
        <div className="border-l border-black/5 bg-white/80 backdrop-blur-sm overflow-y-auto">
          <DetailPanelLight eventId={selectedEventId} onClose={() => onSelectHearing("")} />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function SectionLabel({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-4 rounded-full" style={{ background: color }} />
      <h2 className="text-xs font-bold uppercase tracking-wider font-heading" style={{ color }}>{label}</h2>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full font-heading"
        style={{ color, background: `${color}12` }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Light Detail Panel ──────────────────────────────────────────

function DetailPanelLight({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data: hearing, isLoading } = useHearingDetail(eventId);

  if (isLoading) return <div className="p-6 text-text-muted animate-pulse">Loading...</div>;
  if (!hearing) return <div className="p-6 text-text-muted">Not found.</div>;

  const isComplete = hearing.status === HearingStatus.COMPLETE;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <StatusBadge status={hearing.status} />
        <button onClick={onClose} className="text-text-faint hover:text-text text-lg transition-colors">&times;</button>
      </div>

      <h2 className="text-base font-semibold text-text font-heading leading-snug mb-2">{hearing.title}</h2>
      <p className="text-xs text-text-muted mb-4">
        {hearing.committee_name} &middot; {formatDate(hearing.hearing_date)}
      </p>

      {hearing.stages.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint mb-2 font-heading">Stages</p>
          {hearing.stages.map((s: { stage_name: string; completed_at: string | null; error: string | null; duration_seconds: number | null }) => (
            <div key={s.stage_name} className="flex items-center gap-2 py-1">
              <span className="w-2 h-2 rounded-full"
                style={{ background: s.error ? "#C0452A" : s.completed_at ? "#72A375" : "#E0E0E0" }}
              />
              <span className="text-xs text-text-muted">{s.stage_name}</span>
              {s.duration_seconds != null && (
                <span className="text-xs text-text-faint ml-auto">{Math.round(s.duration_seconds)}s</span>
              )}
            </div>
          ))}
        </div>
      )}

      {isComplete && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint mb-2 font-heading">Deliverables</p>
          <div className="rounded-lg p-3 bg-[#f5f5f5]">
            <p className="text-xs text-text-muted mb-2">Audio Brief</p>
            <audio controls preload="none" className="w-full h-8">
              <source src={artifactUrl(eventId, "briefs/generic/audio_brief.mp3")} type="audio/mpeg" />
            </audio>
          </div>
          <div className="rounded-lg p-3 bg-[#f5f5f5]">
            <p className="text-xs text-text-muted mb-2">Podcast Episode</p>
            <audio controls preload="none" className="w-full h-8">
              <source src={artifactUrl(eventId, "briefs/generic/podcast_episode.mp3")} type="audio/mpeg" />
            </audio>
          </div>
        </div>
      )}

      {hearing.congress_gov_url && (
        <a href={hearing.congress_gov_url} target="_blank" rel="noopener"
          className="inline-block mt-4 text-xs text-navy hover:underline transition-colors"
        >
          View on Congress.gov &rarr;
        </a>
      )}
    </div>
  );
}
