/**
 * "Gradient Mesh" — Stripe-style animated gradient with frosted cards.
 *
 * Animated shifting gradient background (navy/teal/green),
 * frosted white cards floating on top. Immediate visual wow.
 */

import { useHearings } from "../hooks/useHearings";
import { useStats } from "../hooks/useStats";
// useCommittees available for future use
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

function FrostedCard({
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
  const chamberColor = hearing.committee_id.startsWith("senate") ? "#0039A6" : "#8B1A1A";

  return (
    <div
      onClick={() => onSelect(hearing.event_id)}
      className="cursor-pointer rounded-2xl transition-all duration-300"
      style={{
        background: isSelected
          ? "rgba(255,255,255,0.85)"
          : "rgba(255,255,255,0.55)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: isSelected ? "1px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.4)",
        padding: "22px",
        boxShadow: isSelected
          ? "0 8px 32px rgba(0,0,0,0.12)"
          : "0 4px 16px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.12)";
        e.currentTarget.style.background = "rgba(255,255,255,0.8)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = isSelected ? "0 8px 32px rgba(0,0,0,0.12)" : "0 4px 16px rgba(0,0,0,0.06)";
        e.currentTarget.style.background = isSelected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)";
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-heading" style={{ color: chamberColor }}>
            {hearing.committee_name}
          </span>
          <span className="text-[11px] text-[#999]">{formatDate(hearing.hearing_date)}</span>
        </div>
        <StatusBadge status={hearing.status} />
      </div>

      <p className="text-[15px] font-semibold text-[#111] leading-snug mb-4 font-heading" style={{ letterSpacing: "-0.01em" }}>
        {hearing.title}
      </p>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {isActionable && <ProcessButton eventId={hearing.event_id} status={hearing.status} />}
        {isComplete && hearing.hearing_id && (
          <>
            <button
              onClick={() => onSelect(hearing.event_id)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl font-heading bg-white border border-[#ddd] text-[#333] hover:border-[#0039A6] hover:text-[#0039A6] transition-all"
            >
              Read Memo
            </button>
            <a href={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")}
              target="_blank" rel="noopener"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl font-heading text-white transition-all"
              style={{ background: "linear-gradient(135deg, #0039A6, #4A90C2)", boxShadow: "0 2px 10px rgba(0,57,166,0.25)" }}
            >
              Brief
            </a>
            <a href={artifactUrl(hearing.event_id, "briefs/generic/podcast_episode.mp3")}
              target="_blank" rel="noopener"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl font-heading text-white transition-all"
              style={{ background: "linear-gradient(135deg, #5a8a5d, #8FCF92)", boxShadow: "0 2px 10px rgba(114,163,117,0.25)" }}
            >
              Podcast
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function GradientMesh({ onSelectHearing, selectedEventId }: Props) {
  const { data: stats } = useStats();
  const { data } = useHearings({ limit: 200 });

  const hearings = data?.hearings ?? [];
  const ready = hearings.filter((h) => h.status === HearingStatus.READY);
  const complete = hearings.filter((h) => h.status === HearingStatus.COMPLETE);
  const inProgress = hearings.filter(
    (h) => h.status === HearingStatus.PREPARING || h.status === HearingStatus.PROCESSING
  );
  const rest = hearings.filter(
    (h) => !([HearingStatus.READY, HearingStatus.COMPLETE, HearingStatus.PREPARING, HearingStatus.PROCESSING] as HearingStatus[]).includes(h.status)
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #c3d8ea 0%, #b8d4c8 30%, #d1e4d6 60%, #c8dbe9 100%)" }}
        />
        {/* Mesh blobs */}
        <div className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-40"
          style={{ background: "radial-gradient(circle, #0039A6 0%, transparent 70%)", top: "-200px", right: "-200px", animation: "meshFloat1 20s ease-in-out infinite" }}
        />
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-30"
          style={{ background: "radial-gradient(circle, #72A375 0%, transparent 70%)", bottom: "-100px", left: "-100px", animation: "meshFloat2 25s ease-in-out infinite" }}
        />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[80px] opacity-20"
          style={{ background: "radial-gradient(circle, #4A90C2 0%, transparent 70%)", top: "40%", left: "40%", animation: "meshFloat3 18s ease-in-out infinite" }}
        />
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes meshFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.05); }
          66% { transform: translate(20px, -20px) scale(0.95); }
        }
        @keyframes meshFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.97); }
        }
        @keyframes meshFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(1.1); }
        }
      `}</style>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="px-10 pt-10 pb-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-brand text-4xl font-extrabold tracking-tighter">
                <span style={{ color: "#0039A6" }}>Read</span><span style={{ color: "#5a8a5d" }}>out</span>
              </h1>
              <p className="text-sm text-[#555] font-heading mt-1">Congressional Hearing Intelligence</p>
            </div>
            {stats && (
              <div className="flex items-center gap-3">
                {[
                  { label: "Tracked", value: stats.total_hearings, bg: "rgba(255,255,255,0.6)" },
                  { label: "Ready", value: stats.ready_count, bg: "rgba(0,57,166,0.08)" },
                  { label: "Processing", value: stats.preparing_count + stats.processing_count, bg: "rgba(184,134,11,0.08)" },
                  { label: "Complete", value: stats.complete_count, bg: "rgba(114,163,117,0.1)" },
                ].map((s) => (
                  <div key={s.label} className="px-4 py-2.5 rounded-2xl backdrop-blur-sm" style={{ background: s.bg, border: "1px solid rgba(255,255,255,0.4)" }}>
                    <span className="text-xl font-extrabold font-heading text-[#111]">{s.value}</span>
                    <span className="text-[11px] text-[#777] ml-1.5">{s.label.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Cards */}
        <div className="px-10 pb-10 max-w-[1200px]">
          {ready.length > 0 && (
            <section className="mb-8">
              <SectionDot label="Action Required" count={ready.length} color="#0039A6" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {ready.map((h) => (
                  <FrostedCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
                ))}
              </div>
            </section>
          )}

          {inProgress.length > 0 && (
            <section className="mb-8">
              <SectionDot label="Processing" count={inProgress.length} color="#B8860B" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {inProgress.slice(0, 8).map((h) => (
                  <FrostedCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
                ))}
              </div>
              {inProgress.length > 8 && <p className="text-xs text-[#888] mt-3">+ {inProgress.length - 8} more</p>}
            </section>
          )}

          {complete.length > 0 && (
            <section className="mb-8">
              <SectionDot label="Completed" count={complete.length} color="#5a8a5d" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {complete.map((h) => (
                  <FrostedCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="mb-8">
              <SectionDot label="Pipeline" count={rest.length} color="#999" />
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {rest.slice(0, 12).map((h) => (
                  <FrostedCard key={h.event_id} hearing={h} onSelect={onSelectHearing} isSelected={selectedEventId === h.event_id} />
                ))}
              </div>
              {rest.length > 12 && <p className="text-xs text-[#888] mt-3">+ {rest.length - 12} more in pipeline</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionDot({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <h2 className="text-xs font-bold uppercase tracking-wider font-heading" style={{ color }}>{label}</h2>
      <span className="text-xs text-[#aaa]">{count}</span>
    </div>
  );
}
