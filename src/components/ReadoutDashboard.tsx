/**
 * ML-65: Readout Dashboard — contemporary design.
 *
 * Stripe/Google-inspired: animated gradient mesh, glassmorphism cards,
 * staggered entrance animations, smooth hover states, Inter.
 * Capitol photo background at low opacity.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHearings } from "../hooks/useHearings";
import { useCommittees } from "../hooks/useCommittees";
import { useHearingDetail } from "../hooks/useHearingDetail";
import { useKeywordCounts } from "../hooks/useKeywordCounts";
import { HearingStatus } from "../types/api";
import type { HearingListItem, HearingListResponse, CommitteeInfo } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { ProcessButton } from "./ProcessButton";
import { artifactUrl, fetchMemo, toggleHearingFlag } from "../api/client";
import { downloadMemoAsDocx } from "../utils/memoToDocx";
import { MemoViewer } from "./MemoViewer";
import { TranscriptViewer } from "./TranscriptViewer";

// ─── Helpers ──────────────────────────────────────────────────────

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; }
}
function shortDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return d; }
}

function summarizeTitle(title: string, max = 80): string {
  if (title.length <= max) return title;
  const biz = title.match(/^Business meeting to consider (.+)/i);
  if (biz) {
    const r = biz[1];
    const nom = r.match(/the nomination[s]? of ([^,]+)/i);
    if (nom) return `Business Meeting: ${nom[1].trim()} nomination`;
    const bill = r.match(/(S\.\d+|H\.R\.\d+|S\.Res\.\d+|H\.Res\.\d+)/);
    if (bill) return `Business Meeting: ${bill[1]}`;
    return `Business Meeting: ${r.slice(0, 50).trim()}...`;
  }
  const ex = title.match(/^(?:Oversight )?[Hh]earings? to examine (.+)/i);
  if (ex) { const t = ex[1].split(/,|focusing on/i)[0].trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
  const c = title.slice(0, max).lastIndexOf(",");
  if (c > 40) return title.slice(0, c).trim();
  return title.slice(0, max - 3).trim() + "...";
}

// ─── Committee identity ───────────────────────────────────────────

const CID: Record<string, { code: string; accent: string; ch: string }> = {
  senate_banking:        { code: "BNK", accent: "#0039A6", ch: "S" },
  house_finserv:         { code: "FIN", accent: "#1a6b3c", ch: "H" },
  senate_finance:        { code: "TAX", accent: "#6B21A8", ch: "S" },
  house_ways_means:      { code: "W&M", accent: "#9333EA", ch: "H" },
  house_energy_commerce: { code: "E&C", accent: "#CA8A04", ch: "H" },
  house_judiciary:       { code: "JUD", accent: "#8B1A1A", ch: "H" },
  house_budget:          { code: "BDG", accent: "#0E7490", ch: "H" },
  senate_budget:         { code: "BDG", accent: "#0891B2", ch: "S" },
  senate_judiciary:      { code: "JUD", accent: "#7C2D12", ch: "S" },
  joint_economic:        { code: "JEC", accent: "#475569", ch: "J" },
  house_appropriations:  { code: "APR", accent: "#B45309", ch: "H" },
  senate_appropriations: { code: "APR", accent: "#D97706", ch: "S" },
  house_oversight:       { code: "OVR", accent: "#059669", ch: "H" },
  senate_commerce:       { code: "SCI", accent: "#2563EB", ch: "S" },
};
function cid(id: string) { return CID[id] ?? { code: "COM", accent: "#666", ch: "?" }; }

// ─── Global styles (injected once) ────────────────────────────────

const GLOBAL_STYLES = `
  @keyframes meshA { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-60px,50px) scale(1.08)} 66%{transform:translate(40px,-40px) scale(.92)} }
  @keyframes meshB { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(50px,-60px) scale(1.1)} 66%{transform:translate(-30px,30px) scale(.95)} }
  @keyframes meshC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,40px) scale(1.15)} }
  @keyframes meshD { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-50px) scale(1.06)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
  @keyframes countUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  .card-enter { animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .stat-enter { animation: countUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .expand-enter { animation: scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* Flip card */
  .flip-container { perspective: 1200px; transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
  .flip-container.is-flipped {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 825px !important;
    height: 640px !important;
    z-index: 60 !important;
    min-height: unset !important;
  }
  .flip-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    transform-style: preserve-3d;
  }
  .flip-inner.flipped { transform: rotateY(180deg); }
  .flip-front, .flip-back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: 10px;
    overflow: hidden;
  }
  .flip-back { transform: rotateY(180deg); overflow-y: auto; }
`;

// ─── Flip Card ────────────────────────────────────────────────────

function Card({ hearing, index, flippedId, onFlip, onOpenMemo, onOpenTranscript, showFlag = false, isFlagged = false, onToggleFlag, matchedKeywords = [], keywordCounts }: {
  hearing: HearingListItem; index: number; flippedId: string | null; onFlip: (id: string | null) => void; onOpenMemo: (id: string) => void; onOpenTranscript: (id: string) => void; showFlag?: boolean; isFlagged?: boolean; onToggleFlag?: (eventId: string) => void; matchedKeywords?: string[]; keywordCounts?: Record<string, number>;
}) {
  const c = cid(hearing.committee_id);
  const isComplete = hearing.status === HearingStatus.COMPLETE;
  const isReady = hearing.status === HearingStatus.READY;
  const isPreparing = hearing.status === HearingStatus.PREPARING;
  const isProcessing = hearing.status === HearingStatus.PROCESSING;
  const isActionable = isReady || isPreparing || isProcessing;
  const isFlipped = flippedId === hearing.event_id;
  const [audioError, setAudioError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Close on escape
  useEffect(() => {
    if (!isFlipped) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onFlip(null); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isFlipped, onFlip]);

  const glassStyle = {
    background: "rgba(255,255,255,0.55)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.4)",
  };

  return (
    <>
      {/* Dark backdrop when flipped */}
      {isFlipped && (
        <div
          className="fixed inset-0 z-50 transition-opacity duration-300"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
          onClick={() => onFlip(null)}
        />
      )}

      <div
        className={`card-enter flip-container cursor-pointer ${isFlipped ? "is-flipped" : ""}`}
        style={{ minHeight: "260px", animationDelay: `${index * 40}ms` }}
        onClick={() => onFlip(isFlipped ? null : hearing.event_id)}
      >
        <div className={`flip-inner ${isFlipped ? "flipped" : ""}`}>
          {/* ─── FRONT ─── */}
          <div className="flip-front flex flex-col p-6 group transition-shadow duration-300 hover:shadow-lg"
            style={glassStyle}
            onMouseEnter={(e) => {
              if (!isFlipped) { e.currentTarget.style.background = "rgba(255,255,255,0.78)"; e.currentTarget.style.borderColor = `${c.accent}25`; }
            }}
            onMouseLeave={(e) => {
              if (!isFlipped) { e.currentTarget.style.background = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }
            }}
          >
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-xs font-bold tracking-wider"
                  style={{ background: `${c.accent}12`, color: c.accent }}>
                  {c.ch}.{c.code}
                </span>
                <span className="text-[15px] font-bold truncate flex-1" style={{ color: c.accent }}>
                  {hearing.committee_name}
                </span>
                {showFlag && (
                  <button onClick={(e) => { e.stopPropagation(); onToggleFlag?.(hearing.event_id); }}
                    className="ml-auto flex-shrink-0 transition-all duration-200 hover:scale-110"
                    title={isFlagged ? "Remove flag" : "Flag — auto-process when available"}>
                    {isFlagged ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={c.accent} stroke={c.accent} strokeWidth="1.5">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[#666] hover:text-[#444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
            <p className="text-2xl font-bold text-[#1a1a1a] mb-1" style={{ letterSpacing: "-0.02em" }}>
              {shortDate(hearing.hearing_date)}
            </p>
            <p className="text-[15px] text-[#555] leading-snug flex-1" title={hearing.title}>
              {summarizeTitle(hearing.title, 160)}
            </p>
            {matchedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {matchedKeywords.slice(0, 2).map((kw) => {
                  const count = keywordCounts?.[kw];
                  return (
                    <span key={kw} className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(0,57,166,0.08)", color: "#0039A6" }}>
                      {kw}{count != null && count > 0 ? ` (${count})` : ""}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-2 flex items-center" style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
              {isComplete && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#72A375] animate-pulse" />
                  <span className="text-[12px] text-[#72A375] font-bold">Briefing Ready</span>
                </div>
              )}
              {isReady && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0039A6]" />
                  <span className="text-xs text-[#0039A6] font-semibold">Ready to process</span>
                </div>
              )}
              {(isPreparing || isProcessing) && (
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7] animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7] animate-pulse" style={{ animationDelay: "200ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7B5EA7] animate-pulse" style={{ animationDelay: "400ms" }} />
                  </div>
                  <span className="text-xs text-[#7B5EA7] font-semibold">{isPreparing ? "Preparing" : "Processing"}</span>
                </div>
              )}
              {!isComplete && !isReady && !isPreparing && !isProcessing && (
                <span className="text-xs text-[#666]">In pipeline</span>
              )}
            </div>
          </div>

          {/* ─── BACK (expanded) ─── */}
          <div className="flip-back flex flex-col p-8" style={{ ...glassStyle, background: "rgba(255,255,255,0.96)" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider"
                  style={{ background: `${c.accent}10`, color: c.accent }}>
                  {c.ch}.{c.code}
                </span>
                <span className="text-xs text-[#444]">{hearing.committee_name}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onFlip(null); }}
                className="text-[#666] hover:text-[#666] text-xl transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Date + full title — larger fonts for bigger card */}
            <p className="text-2xl font-bold text-[#1a1a1a] mb-1" style={{ letterSpacing: "-0.02em" }}>
              {shortDate(hearing.hearing_date)}
            </p>
            <p className="text-[15px] text-[#555] leading-snug mb-4" style={{ letterSpacing: "-0.01em" }}>
              {hearing.title}
            </p>

            {/* Pipeline status info for non-actionable, non-complete hearings */}
            {!isActionable && !isComplete && (
              <div className="mb-4 rounded-xl p-4" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="mb-3"><StatusBadge status={hearing.status} /></div>
                {hearing.status === HearingStatus.DETECTED && (
                  <div>
                    <p className="text-sm font-semibold text-[#444] mb-1">Video Not Yet Available</p>
                    <p className="text-xs text-[#666] leading-relaxed">
                      This hearing has been detected on Congress.gov but no video source has been found yet.
                      The system will automatically check for video availability.
                    </p>
                  </div>
                )}
                {hearing.status === HearingStatus.RESOLVED && (
                  <div>
                    <p className="text-sm font-semibold text-[#444] mb-1">Video Found — Awaiting Processing</p>
                    <p className="text-xs text-[#666] leading-relaxed">
                      {hearing.video_source_type ? `Source: ${hearing.video_source_type.replace(/_/g, " ")}` : "A video source has been located."}
                      {" "}Auto-processing will begin shortly.
                    </p>
                  </div>
                )}
                {hearing.status === HearingStatus.FAILED && (
                  <div>
                    <p className="text-sm font-semibold text-[#C0452A] mb-1">Processing Failed</p>
                    <p className="text-xs text-[#666] leading-relaxed">
                      An error occurred during processing. The system may retry automatically,
                      or a manual reprocess can be triggered.
                    </p>
                  </div>
                )}
                {hearing.status === HearingStatus.POSTPONED && (
                  <div>
                    <p className="text-sm font-semibold text-[#444] mb-1">Hearing Postponed</p>
                    <p className="text-xs text-[#666] leading-relaxed">
                      This hearing has been postponed per Congress.gov. It will be updated
                      if rescheduled.
                    </p>
                  </div>
                )}
                {hearing.status === HearingStatus.CANCELED && (
                  <div>
                    <p className="text-sm font-semibold text-[#444] mb-1">Hearing Canceled</p>
                    <p className="text-xs text-[#666] leading-relaxed">
                      This hearing has been canceled per Congress.gov.
                    </p>
                  </div>
                )}
                {/* Hearing metadata */}
                {(hearing.hearing_type || (hearing.meeting_status && hearing.meeting_status !== "No meeting status")) && (
                  <div className="mt-3 pt-3 flex flex-wrap gap-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    {hearing.hearing_type && (
                      <span className="text-xs text-[#666]">
                        <span className="font-semibold text-[#444]">Type:</span> {hearing.hearing_type}
                      </span>
                    )}
                    {hearing.meeting_status && hearing.meeting_status !== "No meeting status" && (
                      <span className="text-xs text-[#666]">
                        <span className="font-semibold text-[#444]">Status:</span> {hearing.meeting_status}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Audio + Video — only render when backend confirms artifact exists */}
            {isComplete && hearing.hearing_id && (hearing.has_audio_brief || hearing.has_video) && (
              <div className={`grid ${(hearing.has_audio_brief && !audioError) && (hearing.has_video && !videoError) ? "grid-cols-2" : "grid-cols-1"} gap-3 flex-1 min-h-0`} onClick={(e) => e.stopPropagation()}>
                {hearing.has_audio_brief && !audioError && (
                  <div className="rounded-lg p-3 flex flex-col" style={{ background: `${c.accent}05`, border: `1px solid ${c.accent}10` }}>
                    <p className="text-xs font-bold text-[#444] mb-2 uppercase tracking-wider">Audio Brief</p>
                    <div className="flex-1 flex items-center">
                      <audio controls preload="none" className="w-full" style={{ height: "32px" }} onError={() => setAudioError(true)}>
                        <source src={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")} type="audio/mpeg" />
                      </audio>
                    </div>
                  </div>
                )}
                {hearing.has_video && !videoError && (
                  <div className="rounded-lg p-3 flex flex-col" style={{ background: "rgba(0,57,166,0.03)", border: "1px solid rgba(0,57,166,0.06)" }}>
                    <p className="text-xs font-bold text-[#444] mb-2 uppercase tracking-wider">Video Highlights</p>
                    <video controls preload="none" className="w-full rounded aspect-video" onError={() => setVideoError(true)}>
                      <source src={artifactUrl(hearing.event_id, "briefs/generic/video_highlights.mp4")} type="video/mp4" />
                    </video>
                  </div>
                )}
              </div>
            )}
            {isComplete && hearing.hearing_id && !hearing.has_audio_brief && !hearing.has_video && (
              <p className="text-xs text-[#999] italic text-center py-2">Media not yet available</p>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {isActionable && <ProcessButton eventId={hearing.event_id} status={hearing.status} />}
              {isComplete && (
                <button
                  onClick={() => { onFlip(null); onOpenMemo(hearing.event_id); }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)`, boxShadow: `0 4px 14px ${c.accent}20` }}
                >
                  Read Full Memo
                </button>
              )}
              {isComplete && hearing.has_transcript && (
                <button
                  onClick={() => { onFlip(null); onOpenTranscript(hearing.event_id); }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5"
                  style={{ background: "white", color: "#333", border: "2px solid #e8e8e8" }}
                >
                  Transcript
                </button>
              )}
              {hearing.congress_gov_url && (
                <a href={hearing.congress_gov_url} target="_blank" rel="noopener"
                  className="text-xs text-[#444] hover:text-[#0039A6] transition-colors">
                  Congress.gov →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Expanded View ────────────────────────────────────────────────

export function ExpandedView({ hearing, onClose }: { hearing: HearingListItem; onClose: () => void }) {
  const c = cid(hearing.committee_id);
  const { data: detail } = useHearingDetail(hearing.event_id);
  const isComplete = hearing.status === HearingStatus.COMPLETE;
  const isActionable = hearing.status === HearingStatus.READY || hearing.status === HearingStatus.PREPARING || hearing.status === HearingStatus.PROCESSING;
  const [showMemo, setShowMemo] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(10,10,15,0.4)", backdropFilter: "blur(12px)" }} onClick={onClose} />
      <div className="expand-enter fixed inset-6 md:inset-10 lg:inset-16 z-50 rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: `0 32px 100px rgba(0,0,0,0.15), 0 0 0 1px ${c.accent}10`,
        }}
      >
        {/* Gradient top edge */}
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${c.accent}, ${c.accent}66, transparent)` }} />

        {/* Header */}
        <div className="px-10 pt-8 pb-6 flex items-start justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="flex-1 pr-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider" style={{ background: `${c.accent}0c`, color: c.accent }}>
                {c.ch}.{c.code}
              </span>
              <span className="text-sm text-[#444]">{hearing.committee_name}</span>
              <span className="text-sm text-[#ddd]">/</span>
              <span className="text-sm text-[#444]">{formatDate(hearing.hearing_date)}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#111] leading-tight" style={{ letterSpacing: "-0.025em" }}>
              {hearing.title}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge status={hearing.status} />
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#666] hover:text-[#666] hover:bg-black/4 transition-all text-lg">
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
            <div>
              {/* Progress bar */}
              {detail?.stages && detail.stages.length > 0 && (
                <div className="mb-8">
                  <div className="flex gap-1.5 mb-2">
                    {["ingest", "transcribe", "resolve_speakers", "generate_memo"].map((name) => {
                      const s = detail.stages.find((x: { stage_name: string }) => x.stage_name === name);
                      return (
                        <div key={name} className="flex-1 h-1.5 rounded-full overflow-hidden bg-[#eee]">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: s?.completed_at ? "100%" : s?.error ? "100%" : "0%", background: s?.error ? "#C0452A" : c.accent }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    {["Download", "Transcribe", "Speakers", "Analysis"].map((l) => (
                      <span key={l} className="text-[9px] text-[#666] font-medium">{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap mb-6" onClick={(e) => e.stopPropagation()}>
                {isActionable && <ProcessButton eventId={hearing.event_id} status={hearing.status} />}
                {isComplete && hearing.hearing_id && (
                  <button
                    onClick={() => setShowMemo(!showMemo)}
                    className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                      background: showMemo ? "#0039A6" : "white",
                      color: showMemo ? "white" : "#333",
                      border: showMemo ? "2px solid #0039A6" : "2px solid #e8e8e8",
                    }}
                  >
                    {showMemo ? "Hide Memo" : "Read Full Memo"}
                  </button>
                )}
              </div>

              {/* Inline memo */}
              {showMemo && isComplete && (
                <div className="mb-6 rounded-xl p-6 overflow-y-auto" style={{ background: "#fafafa", border: "1px solid #f0f0f0", maxHeight: "400px" }}>
                  <MemoViewer eventId={hearing.event_id} />
                </div>
              )}

              {/* Inline players — only render when backend confirms artifact exists */}
              {isComplete && hearing.hearing_id && (hearing.has_audio_brief || hearing.has_video) && (
                <div className={`grid ${(hearing.has_audio_brief && !audioError) && (hearing.has_video && !videoError) ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
                  {hearing.has_audio_brief && !audioError && (
                    <div className="rounded-xl p-4" style={{ background: `${c.accent}04`, border: `1px solid ${c.accent}08` }}>
                      <p className="text-[11px] font-bold text-[#444] mb-2 uppercase tracking-wider">Audio Brief (~2 min)</p>
                      <audio controls preload="none" className="w-full h-10" onError={() => setAudioError(true)}>
                        <source src={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")} type="audio/mpeg" />
                      </audio>
                    </div>
                  )}
                  {hearing.has_video && !videoError && (
                    <div className="rounded-xl p-4" style={{ background: "rgba(0,57,166,0.03)", border: "1px solid rgba(0,57,166,0.06)" }}>
                      <p className="text-[11px] font-bold text-[#444] mb-2 uppercase tracking-wider">Video Highlights (~60s)</p>
                      <video controls preload="none" className="w-full rounded-lg aspect-video" onError={() => setVideoError(true)}>
                        <source src={artifactUrl(hearing.event_id, "briefs/generic/video_highlights.mp4")} type="video/mp4" />
                      </video>
                    </div>
                  )}
                </div>
              )}
              {isComplete && hearing.hearing_id && !hearing.has_audio_brief && !hearing.has_video && (
                <p className="text-xs text-[#999] italic text-center py-3">Media not yet available</p>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-5">
              <div className="rounded-xl p-5" style={{ background: `${c.accent}03`, border: `1px solid ${c.accent}08` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#666] mb-3">Hearing Info</p>
                {[
                  { k: "Committee", v: hearing.committee_name },
                  { k: "Date", v: formatDate(hearing.hearing_date) },
                  { k: "Type", v: hearing.hearing_type || "Hearing" },
                ].map((r) => (
                  <div key={r.k} className="mb-2.5">
                    <p className="text-[10px] text-[#444] uppercase tracking-wider">{r.k}</p>
                    <p className="text-sm text-[#333] font-medium">{r.v}</p>
                  </div>
                ))}
                {hearing.congress_gov_url && (
                  <a href={hearing.congress_gov_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-semibold mt-1 transition-colors" style={{ color: c.accent }}>
                    Congress.gov
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </a>
                )}
              </div>

              {detail?.stages && detail.stages.length > 0 && (
                <div className="rounded-xl p-5 bg-[#fafafa] border border-[#f0f0f0]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#666] mb-3">Pipeline</p>
                  {detail.stages.map((s: { stage_name: string; completed_at: string | null; error: string | null; duration_seconds: number | null }) => (
                    <div key={s.stage_name} className="flex items-center gap-2 py-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.error ? "#C0452A" : s.completed_at ? "#72A375" : "#e0e0e0" }} />
                      <span className="text-xs text-[#666] flex-1 capitalize">{s.stage_name.replace(/_/g, " ")}</span>
                      {s.duration_seconds != null && <span className="text-[11px] text-[#666]">{s.duration_seconds < 60 ? `${Math.round(s.duration_seconds)}s` : `${Math.round(s.duration_seconds / 60)}m`}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Committee Dropdown ───────────────────────────────────────────

function CommitteeDropdown({ committees, selected, onSelect, countMap }: {
  committees: CommitteeInfo[]; selected: string | null; onSelect: (id: string | null) => void; countMap: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const senate = committees.filter((c) => c.chamber === "senate");
  const house = committees.filter((c) => c.chamber === "house");
  const joint = committees.filter((c) => c.chamber === "joint");

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300"
        style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.4)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
        {selected ? committees.find(c => c.committee_id === selected)?.short_name : "All Committees"}
        <svg className={`w-3.5 h-3.5 text-[#444] transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="expand-enter absolute top-full left-0 mt-2 w-80 rounded-xl overflow-hidden z-50"
          style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(24px)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 16px 48px rgba(0,0,0,0.12)" }}>
          <button onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${!selected ? "bg-[#0039A6]/5 text-[#0039A6] font-bold" : "text-[#333] hover:bg-black/3"}`}>
            All Committees
          </button>
          {[{ l: "Senate", items: senate, col: "#0039A6" }, { l: "House", items: house, col: "#8B1A1A" }, { l: "Joint", items: joint, col: "#475569" }]
            .filter(g => g.items.length > 0).map((g) => (
            <div key={g.l}>
              <div className="px-4 pt-3 pb-1"><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: g.col }}>{g.l}</p></div>
              {g.items.map((c) => (
                <button key={c.committee_id} onClick={() => { onSelect(c.committee_id); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${selected === c.committee_id ? "font-bold" : "text-[#444] hover:bg-black/3"}`}
                  style={selected === c.committee_id ? { background: `${cid(c.committee_id).accent}08`, color: cid(c.committee_id).accent } : {}}>
                  <span>{c.short_name}</span><span className="text-[11px] text-[#666]">{countMap.get(c.committee_id) ?? 0}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────


// ─── Month/Year Dropdowns ─────────────────────────────────────────

function DateFilter({ month, year, onChangeMonth, onChangeYear }: {
  month: string | null; year: string | null;
  onChangeMonth: (v: string | null) => void;
  onChangeYear: (v: string | null) => void;
}) {
  const months = [
    { label: "Jan", value: "01" }, { label: "Feb", value: "02" }, { label: "Mar", value: "03" },
    { label: "Apr", value: "04" }, { label: "May", value: "05" }, { label: "Jun", value: "06" },
    { label: "Jul", value: "07" }, { label: "Aug", value: "08" }, { label: "Sep", value: "09" },
    { label: "Oct", value: "10" }, { label: "Nov", value: "11" }, { label: "Dec", value: "12" },
  ];
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1];

  // Match CommitteeDropdown sizing: same height, padding, border-radius, font
  const selectStyle = {
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.4)",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    color: "#333",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 16px",
    borderRadius: "12px",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: "32px",
    cursor: "pointer",
    minWidth: "120px",
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={month ?? ""}
        onChange={(e) => onChangeMonth(e.target.value || null)}
        style={selectStyle}
      >
        <option value="">All months</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select
        value={year ?? ""}
        onChange={(e) => onChangeYear(e.target.value || null)}
        style={selectStyle}
      >
        <option value="">All years</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Card Carousel with dots ──────────────────────────────────────

// CardCarousel — grid + pagination at the bottom
function CardCarousel({ items, flippedId, onFlip, onOpenMemo, onOpenTranscript, perPage, showFlag, savedIds, onToggleFlag, matchKeywords, keywordCounts }: {
  items: HearingListItem[];
  flippedId: string | null;
  onFlip: (id: string | null) => void;
  onOpenMemo: (id: string) => void;
  onOpenTranscript: (id: string) => void;
  perPage: number;
  showFlag?: boolean;
  savedIds?: Set<string>;
  onToggleFlag?: (eventId: string) => void;
  matchKeywords?: (title: string) => string[];
  keywordCounts?: Map<string, Record<string, number>>;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / perPage);
  const visible = items.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visible.map((h, i) => (
          <Card key={h.event_id} hearing={h} index={i} flippedId={flippedId} onFlip={onFlip} onOpenMemo={onOpenMemo} onOpenTranscript={onOpenTranscript} showFlag={showFlag} isFlagged={savedIds?.has(h.event_id)} onToggleFlag={onToggleFlag} matchedKeywords={matchKeywords?.(h.title)} keywordCounts={keywordCounts?.get(h.event_id)} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {/* Left chevron */}
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="text-[#555] transition-all duration-200 disabled:opacity-20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className="rounded-full transition-all duration-300"
                style={{ width: page === i ? "20px" : "6px", height: "6px", background: page === i ? "#0039A6" : "rgba(0,0,0,0.15)" }} />
            ))}
            {totalPages > 10 && <span className="text-[10px] text-[#444]">+{totalPages - 10}</span>}
          </div>
          {/* Right chevron */}
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}
            className="text-[#555] transition-all duration-200 disabled:opacity-20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────

function Accordion({ label, count, color, children, defaultOpen = false }: {
  label: string; count: number; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 mb-4 w-full text-left group"
      >
        <div className="w-1.5 h-5 rounded-full" style={{ background: color }} />
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{label}</h2>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ color, background: `${color}15` }}>{count}</span>
        <svg
          className="w-4 h-4 transition-transform duration-300 -ml-1"
          style={{ color, transform: open ? "rotate(180deg)" : "rotate(0)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}20, transparent)` }} />
      </button>

      <div
        className="overflow-hidden transition-all duration-400"
        style={{
          maxHeight: open ? "2000px" : "0",
          opacity: open ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Memo Split View (card left 1/4, memo right 3/4) ─────────────

function MemoSplitView({ hearing, onClose }: { hearing: HearingListItem; onClose: () => void }) {
  const c = cid(hearing.committee_id);
  const [audioError, setAudioError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(10,10,15,0.5)", backdropFilter: "blur(12px)" }} onClick={onClose} />

      {/* Split layout */}
      <div className="relative z-10 flex w-full h-full p-6 gap-5 expand-enter">
        {/* LEFT — hearing card with media (~1/4 width) */}
        <div className="w-[320px] flex-shrink-0 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: `0 24px 80px rgba(0,0,0,0.12), 0 0 0 1px ${c.accent}08` }}>
          {/* Accent top bar */}
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${c.accent}, ${c.accent}66, transparent)` }} />

          <div className="p-6 flex flex-col flex-1 overflow-y-auto">
            {/* Committee badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
                style={{ background: `${c.accent}12`, color: c.accent }}>
                {c.ch}.{c.code}
              </span>
              <span className="text-xs text-[#444] truncate">{hearing.committee_name}</span>
            </div>

            {/* Date + title */}
            <p className="text-2xl font-bold text-[#1a1a1a] mb-1" style={{ letterSpacing: "-0.02em" }}>
              {shortDate(hearing.hearing_date)}
            </p>
            <p className="text-sm text-[#555] leading-snug mb-6">
              {hearing.title}
            </p>

            {/* Audio Brief + Video — only render when backend confirms artifact exists */}
            {hearing.hearing_id && (hearing.has_audio_brief || hearing.has_video) && (
              <div className="space-y-3 mb-4">
                {hearing.has_audio_brief && !audioError && (
                  <div className="rounded-xl p-4" style={{ background: `${c.accent}04`, border: `1px solid ${c.accent}08` }}>
                    <p className="text-[10px] font-bold text-[#444] mb-2 uppercase tracking-wider">Audio Brief</p>
                    <audio controls preload="none" className="w-full" style={{ height: "36px" }} onError={() => setAudioError(true)}>
                      <source src={artifactUrl(hearing.event_id, "briefs/generic/audio_brief.mp3")} type="audio/mpeg" />
                    </audio>
                  </div>
                )}
                {hearing.has_video && !videoError && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(0,57,166,0.03)", border: "1px solid rgba(0,57,166,0.06)" }}>
                    <p className="text-[10px] font-bold text-[#444] mb-2 uppercase tracking-wider">Video Highlights</p>
                    <video controls preload="none" className="w-full rounded-lg" onError={() => setVideoError(true)}>
                      <source src={artifactUrl(hearing.event_id, "briefs/generic/video_highlights.mp4")} type="video/mp4" />
                    </video>
                  </div>
                )}
              </div>
            )}
            {hearing.hearing_id && !hearing.has_audio_brief && !hearing.has_video && (
              <p className="text-xs text-[#999] italic text-center py-2">Media not yet available</p>
            )}

            {/* Links */}
            <div className="mt-auto pt-4 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
              {hearing.congress_gov_url && (
                <a href={hearing.congress_gov_url} target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1 text-xs font-semibold transition-colors" style={{ color: c.accent }}>
                  Congress.gov
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — memo reader (~3/4 width) */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}>
          {/* Header bar */}
          <div className="px-8 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[#1a1a1a]" style={{ letterSpacing: "-0.02em" }}>Briefing Memo</h2>
              <span className="text-xs text-[#666]">{formatDate(hearing.hearing_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const content = await fetchMemo(hearing.event_id);
                    const filename = `${hearing.committee_id}_${hearing.hearing_date}_memo.docx`;
                    await downloadMemoAsDocx(content, filename);
                  } catch (e) {
                    console.error("Download failed:", e);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
                style={{ background: "#0039A6" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                </svg>
                Download
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#666] hover:text-[#666] hover:bg-black/5 transition-all text-lg">
                ×
              </button>
            </div>
          </div>

          {/* Memo content — scrollable */}
          <div className="flex-1 overflow-y-auto px-10 py-8">
            <MemoViewer eventId={hearing.event_id} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Transcript Split View (card left 1/4, transcript right 3/4) ──

function TranscriptSplitView({ hearing, onClose }: { hearing: HearingListItem; onClose: () => void }) {
  const c = cid(hearing.committee_id);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(10,10,15,0.5)", backdropFilter: "blur(12px)" }} onClick={onClose} />

      {/* Split layout */}
      <div className="relative z-10 flex w-full h-full p-6 gap-5 expand-enter">
        {/* LEFT — hearing info (~1/4 width) */}
        <div className="w-[320px] flex-shrink-0 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: `0 24px 80px rgba(0,0,0,0.12), 0 0 0 1px ${c.accent}08` }}>
          {/* Accent top bar */}
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${c.accent}, ${c.accent}66, transparent)` }} />

          <div className="p-6 flex flex-col flex-1">
            {/* Committee badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
                style={{ background: `${c.accent}12`, color: c.accent }}>
                {c.ch}.{c.code}
              </span>
              <span className="text-sm text-[#444]">{hearing.committee_name}</span>
            </div>

            <p className="text-sm text-[#555] mb-2">{formatDate(hearing.hearing_date)}</p>
            <h2 className="text-lg font-bold text-[#111] leading-snug mb-4" style={{ letterSpacing: "-0.02em" }}>
              {hearing.title}
            </h2>

            <StatusBadge status={hearing.status} />

            {hearing.congress_gov_url && (
              <a href={hearing.congress_gov_url} target="_blank" rel="noopener"
                className="mt-auto inline-flex items-center gap-1 text-xs font-semibold transition-colors pt-4" style={{ color: c.accent }}>
                Congress.gov
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* RIGHT — transcript reader (~3/4 width) */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}>
          {/* Header bar */}
          <div className="px-8 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[#1a1a1a]" style={{ letterSpacing: "-0.02em" }}>Transcript</h2>
              <span className="text-xs text-[#666]">{formatDate(hearing.hearing_date)}</span>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#666] hover:text-[#666] hover:bg-black/5 transition-all text-lg">
              &times;
            </button>
          </div>

          {/* Transcript content — scrollable */}
          <div className="flex-1 overflow-y-auto px-10 py-8">
            <TranscriptViewer eventId={hearing.event_id} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────

interface Props {
  onSelectHearing: (eventId: string) => void;
  selectedEventId: string | null;
}

type Page = "dashboard" | "saved" | "matches" | "configure";

export function ReadoutDashboard({ onSelectHearing: _onSelectHearing, selectedEventId: _selectedEventId }: Props) {
  const [page, setPage] = useState<Page>("dashboard");
  const [committeeFilter, setCommitteeFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [memoHearingId, setMemoHearingId] = useState<string | null>(null);
  const [transcriptHearingId, setTranscriptHearingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [keywords, setKeywords] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("readout_keywords") ?? "[]"); } catch { return []; }
  });
  const [keywordInput, setKeywordInput] = useState("");
  const queryClient = useQueryClient();
  const { data: committees } = useCommittees();
  const { data, isLoading } = useHearings({ limit: 250 });

  const countMap = new Map<string, number>();
  // Build counts from raw data
  const allHearings = data?.hearings ?? [];

  // ML-308: Derive savedIds from server data + optimistic toggle via API
  const savedIds = useMemo(() => new Set(allHearings.filter((h) => h.auto_process).map((h) => h.event_id)), [allHearings]);
  const toggleFlag = useCallback(async (eventId: string) => {
    // Optimistic update
    queryClient.setQueryData(["hearings", { limit: 250 }], (old: HearingListResponse | undefined) => {
      if (!old) return old;
      return { ...old, hearings: old.hearings.map((h) => h.event_id === eventId ? { ...h, auto_process: !h.auto_process } : h) };
    });
    try {
      await toggleHearingFlag(eventId);
      queryClient.invalidateQueries({ queryKey: ["hearings"] });
    } catch {
      // Rollback on error
      queryClient.invalidateQueries({ queryKey: ["hearings"] });
    }
  }, [queryClient]);
  for (const h of allHearings) {
    countMap.set(h.committee_id, (countMap.get(h.committee_id) ?? 0) + 1);
  }

  // Apply committee filter client-side (so Saved page can access all hearings)
  let hearings = committeeFilter ? allHearings.filter((h) => h.committee_id === committeeFilter) : allHearings;
  if (yearFilter) {
    hearings = hearings.filter((h) => h.hearing_date.startsWith(yearFilter));
  }
  if (monthFilter && yearFilter) {
    hearings = hearings.filter((h) => h.hearing_date.startsWith(`${yearFilter}-${monthFilter}`));
  } else if (monthFilter) {
    hearings = hearings.filter((h) => h.hearing_date.slice(5, 7) === monthFilter);
  }

  // ML-317: Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    hearings = hearings.filter((h) => h.title.toLowerCase().includes(q));
  }

  // ── ML-311: Keyword helpers ──
  const saveKeywords = (kws: string[]) => {
    setKeywords(kws);
    localStorage.setItem("readout_keywords", JSON.stringify(kws));
  };
  const addKeyword = (raw: string) => {
    const kw = raw.trim();
    if (kw.length < 2) return;
    if (keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) return;
    saveKeywords([...keywords, kw]);
    setKeywordInput("");
  };
  const removeKeyword = (kw: string) => {
    saveKeywords(keywords.filter((k) => k !== kw));
  };
  const matchKeywords = (title: string): string[] => {
    if (keywords.length === 0) return [];
    const t = title.toLowerCase();
    return keywords.filter((kw) => t.includes(kw.toLowerCase()));
  };
  const matchedEventIds = allHearings
    .filter((h) => matchKeywords(h.title).length > 0)
    .map((h) => h.event_id);
  const keywordCountsMap = useKeywordCounts(matchedEventIds, keywords);

  // ── Time-based grouping ──
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Monday-based week (Mon–Sun)
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // 1. This Week — hearing_date falls within current Mon–Sun week
  const thisWeek = hearings.filter((h) => {
    const d = new Date(h.hearing_date);
    return d >= weekStart && d < weekEnd;
  });
  const thisWeekIds = new Set(thisWeek.map((h) => h.event_id));

  // 2. Upcoming — scheduled hearings beyond this week (future)
  const upcoming = hearings.filter((h) => {
    if (thisWeekIds.has(h.event_id)) return false;
    const d = new Date(h.hearing_date);
    return d >= weekEnd;
  });
  const upcomingIds = new Set(upcoming.map((h) => h.event_id));

  // 3. Recent — completed memos from the past ~30 days (before this week)
  const recent = hearings.filter((h) => {
    if (thisWeekIds.has(h.event_id) || upcomingIds.has(h.event_id)) return false;
    if (h.status !== HearingStatus.COMPLETE) return false;
    const d = new Date(h.hearing_date);
    return d >= thirtyDaysAgo && d < weekStart;
  });
  const recentIds = new Set(recent.map((h) => h.event_id));

  // 4. Older — everything else (>30 days old, or past but not yet complete)
  const older = hearings.filter((h) =>
    !thisWeekIds.has(h.event_id) && !upcomingIds.has(h.event_id) && !recentIds.has(h.event_id)
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      <style>{GLOBAL_STYLES}</style>

      {/* ─── Background layers ─── */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient — warm navy/red tones */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #e4e8f0 0%, #eee4e4 35%, #e8e4ef 65%, #e2e6ee 100%)" }} />

        {/* Animated mesh blobs — Meridian Logic navy + red */}
        <div className="absolute w-[1000px] h-[1000px] rounded-full blur-[160px] opacity-22"
          style={{ background: "radial-gradient(circle, #0039A6 0%, transparent 70%)", top: "-350px", right: "-250px", animation: "meshA 24s ease-in-out infinite" }} />
        <div className="absolute w-[800px] h-[800px] rounded-full blur-[140px] opacity-15"
          style={{ background: "radial-gradient(circle, #C0452A 0%, transparent 70%)", bottom: "-250px", left: "-200px", animation: "meshB 30s ease-in-out infinite" }} />
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-12"
          style={{ background: "radial-gradient(circle, #0039A6 0%, transparent 70%)", top: "50%", left: "50%", animation: "meshC 20s ease-in-out infinite" }} />
        <div className="absolute w-[450px] h-[450px] rounded-full blur-[80px] opacity-10"
          style={{ background: "radial-gradient(circle, #C0452A 0%, transparent 70%)", top: "15%", right: "25%", animation: "meshD 26s ease-in-out infinite" }} />

        {/* Capitol photo — visible */}
        <div className="absolute inset-0" style={{ backgroundImage: "url(/capitol.jpg)", backgroundSize: "cover", backgroundPosition: "center 30%", opacity: 0.055, mixBlendMode: "multiply" }} />

        {/* Noise texture for depth */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      </div>

      {/* ─── Content ─── */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-8 pt-8 pb-16">
        {/* Header — branding + three uniform dropdowns */}
        <div className="flex items-end justify-between mb-10">
          <div className="stat-enter" style={{ animationDelay: "0ms" }}>
            <h1 className="font-brand text-5xl font-extrabold" style={{ letterSpacing: "-0.04em" }}>
              <span style={{ color: "#0039A6" }}>Read</span><span style={{ color: "#72A375" }}>out</span>
            </h1>
            {/* Page nav */}
            <div className="flex items-center gap-2 mt-2">
              {([
                { id: "dashboard" as Page, label: "Dashboard" },
                { id: "saved" as Page, label: "Saved" },
                { id: "matches" as Page, label: "Matches" },
                { id: "configure" as Page, label: "Configure" },
              ]).map((p) => (
                <button key={p.id} onClick={() => setPage(p.id)}
                  className="px-3 py-1 text-sm font-semibold rounded-lg transition-all duration-200"
                  style={{
                    background: page === p.id ? "rgba(0,57,166,0.08)" : "transparent",
                    color: page === p.id ? "#0039A6" : "#444",
                  }}>
                  {p.label}
                  {p.id === "saved" && savedIds.size > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#0039A6] text-white leading-none">{savedIds.size}</span>
                  )}
                  {p.id === "matches" && matchedEventIds.length > 0 && (
                    <span className="ml-1 text-[10px] opacity-60">({matchedEventIds.length})</span>
                  )}
                  {p.id === "configure" && keywords.length > 0 && (
                    <span className="ml-1 text-[10px] opacity-60">({keywords.length})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {page === "dashboard" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hearing titles..."
                  className="text-sm pr-8 pl-3 py-2 rounded-lg focus:outline-none focus:border-[#0039A6] transition-colors"
                  style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.4)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", width: 220 }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#444] text-sm font-bold leading-none" style={{ background: "none", border: "none", cursor: "pointer" }}>×</button>
                )}
              </div>
              {committees && <CommitteeDropdown committees={committees} selected={committeeFilter} onSelect={setCommitteeFilter} countMap={countMap} />}
              <DateFilter month={monthFilter} year={yearFilter} onChangeMonth={setMonthFilter} onChangeYear={setYearFilter} />
            </div>
          )}
        </div>

        {/* ─── Saved Page ─── */}
        {page === "saved" && (() => {
          const saved = allHearings.filter((h) => savedIds.has(h.event_id));

          if (saved.length === 0) return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="w-16 h-16 text-[#ddd] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-lg font-bold text-[#555] mb-2">No saved hearings yet</p>
              <p className="text-sm text-[#444] max-w-sm">Flag upcoming hearings from the dashboard to save them here. Flagged hearings auto-process when video becomes available.</p>
            </div>
          );

          return (
            <CardCarousel items={saved} flippedId={flippedId} onFlip={setFlippedId} onOpenMemo={setMemoHearingId} onOpenTranscript={setTranscriptHearingId} perPage={8} showFlag savedIds={savedIds} onToggleFlag={toggleFlag} matchKeywords={matchKeywords} keywordCounts={keywordCountsMap} />
          );
        })()}

        {/* ─── Matches Page (ML-311) ─── */}
        {page === "matches" && (
          (() => {
            const matched = allHearings.filter((h) => matchKeywords(h.title).length > 0);
            return matched.length > 0 ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-5 rounded-full" style={{ background: "#0039A6" }} />
                  <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#0039A6" }}>Keyword Matches</h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ color: "#0039A6", background: "rgba(0,57,166,0.1)" }}>{matched.length}</span>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(0,57,166,0.25), transparent)" }} />
                </div>
                <CardCarousel items={matched} flippedId={flippedId} onFlip={setFlippedId} onOpenMemo={setMemoHearingId} onOpenTranscript={setTranscriptHearingId} perPage={8} savedIds={savedIds} onToggleFlag={toggleFlag} matchKeywords={matchKeywords} keywordCounts={keywordCountsMap} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <svg className="w-16 h-16 text-[#ddd] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg font-bold text-[#555] mb-2">No keyword matches</p>
                <p className="text-sm text-[#444] max-w-sm">
                  {keywords.length === 0
                    ? "Add keywords on the Configure page to see matching hearings here."
                    : "None of the current hearings match your keywords. Matches will appear as new hearings are detected."}
                </p>
                {keywords.length === 0 && (
                  <button onClick={() => setPage("configure")} className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: "rgba(0,57,166,0.08)", color: "#0039A6" }}>
                    Configure Keywords
                  </button>
                )}
              </div>
            );
          })()
        )}

        {/* ─── Configure Page (ML-311) ─── */}
        {page === "configure" && (
          <div className="max-w-lg">
            <h2 className="text-xl font-bold text-[#1a1a1a] mb-2">Topic Alerts</h2>
            <p className="text-sm text-[#444] mb-6">Add keywords to automatically flag hearings that match your interests.</p>
            <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.4)" }}>
              <p className="text-[11px] font-bold text-[#444] uppercase tracking-wider mb-3">Keywords</p>
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {keywords.map((kw) => (
                    <span key={kw} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "rgba(0,57,166,0.08)", color: "#0039A6" }}>
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="ml-1.5 opacity-50 hover:opacity-100 transition-opacity">×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#666] mb-4">No keywords yet. Try adding topics like "stablecoin" or "CFPB".</p>
              )}
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addKeyword(keywordInput);
                  }
                }}
                placeholder="Add keyword..."
                className="w-full px-4 py-2.5 rounded-lg text-sm border border-[#e0e0e0] bg-white/80 focus:outline-none focus:border-[#0039A6] transition-colors"
              />
            </div>
            <div className="mt-6 rounded-xl p-6" style={{ background: "rgba(255,255,255,0.4)", border: "1px dashed rgba(0,0,0,0.1)" }}>
              <p className="text-sm font-semibold text-[#444] mb-1">Multi-Client Keywords</p>
              <p className="text-xs text-[#444] mb-3">Set different keyword lists for each of your clients.</p>
              <button className="px-4 py-2 text-xs font-bold rounded-lg text-white" style={{ background: "linear-gradient(135deg, #0039A6, #4A90C2)" }}>
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}

        {/* ─── Loading Skeleton ─── */}
        {page === "dashboard" && isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="rounded-2xl p-6 animate-pulse" style={{ background: "rgba(255,255,255,0.45)", minHeight: 260, animationDelay: `${i * 60}ms` }}>
                <div className="h-3 w-16 rounded bg-[#ddd] mb-3" />
                <div className="h-5 w-3/4 rounded bg-[#ddd] mb-2" />
                <div className="h-4 w-full rounded bg-[#e8e8e8] mb-1" />
                <div className="h-4 w-2/3 rounded bg-[#e8e8e8]" />
                <div className="mt-auto pt-8"><div className="h-3 w-20 rounded bg-[#ddd]" /></div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Dashboard Content ─── */}
        {page !== "dashboard" ? null : searchQuery ? (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-5 rounded-full" style={{ background: "#0039A6" }} />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#0039A6" }}>Search Results</h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ color: "#0039A6", background: "rgba(0,57,166,0.1)" }}>{hearings.length}</span>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(0,57,166,0.25), transparent)" }} />
            </div>
            {hearings.length > 0 ? (
              <CardCarousel items={hearings} flippedId={flippedId} onFlip={setFlippedId} onOpenMemo={setMemoHearingId} onOpenTranscript={setTranscriptHearingId} perPage={8} savedIds={savedIds} onToggleFlag={toggleFlag} matchKeywords={matchKeywords} keywordCounts={keywordCountsMap} />
            ) : (
              <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.35)", border: "1px dashed rgba(0,57,166,0.12)" }}>
                <p className="text-sm font-medium text-[#666]">No hearings match "{searchQuery}"</p>
              </div>
            )}
          </div>
        ) : (<>

        {/* This Week's Hearings — primary focus, top of page (starts expanded) */}
        {thisWeek.length > 0 && (
          <Accordion label="This Week's Hearings" count={thisWeek.length} color="#4A90C2" defaultOpen>
            <CardCarousel items={thisWeek} flippedId={flippedId} onFlip={setFlippedId} onOpenMemo={setMemoHearingId} onOpenTranscript={setTranscriptHearingId} perPage={8} showFlag savedIds={savedIds} onToggleFlag={toggleFlag} matchKeywords={matchKeywords} keywordCounts={keywordCountsMap} />
          </Accordion>
        )}

        {/* Upcoming — scheduled hearings beyond this week */}
        {upcoming.length > 0 && (
          <Accordion label="Upcoming" count={upcoming.length} color="#0039A6">
            <CardCarousel items={upcoming} flippedId={flippedId} onFlip={setFlippedId} onOpenMemo={setMemoHearingId} onOpenTranscript={setTranscriptHearingId} perPage={8} showFlag savedIds={savedIds} onToggleFlag={toggleFlag} matchKeywords={matchKeywords} keywordCounts={keywordCountsMap} />
          </Accordion>
        )}

        {/* Recent — completed memos from the past ~30 days */}
        {recent.length > 0 && (
          <Accordion label="Recent" count={recent.length} color="#5a8a5d">
            <CardCarousel items={recent} flippedId={flippedId} onFlip={setFlippedId} onOpenMemo={setMemoHearingId} onOpenTranscript={setTranscriptHearingId} perPage={8} savedIds={savedIds} onToggleFlag={toggleFlag} matchKeywords={matchKeywords} keywordCounts={keywordCountsMap} />
          </Accordion>
        )}

        {/* Older — hearings older than 30 days */}
        {older.length > 0 && (
          <Accordion label="Older" count={older.length} color="#555">
            <CardCarousel items={older} flippedId={flippedId} onFlip={setFlippedId} onOpenMemo={setMemoHearingId} onOpenTranscript={setTranscriptHearingId} perPage={8} savedIds={savedIds} onToggleFlag={toggleFlag} matchKeywords={matchKeywords} keywordCounts={keywordCountsMap} />
          </Accordion>
        )}

        {hearings.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-64 text-[#444]">No hearings found{committeeFilter ? " for this committee" : ""}.</div>
        )}
        </>)}

        {/* Memo split view — full screen overlay */}
        {memoHearingId && (() => {
          const h = hearings.find((x) => x.event_id === memoHearingId) ?? allHearings.find((x) => x.event_id === memoHearingId);
          return h ? <MemoSplitView hearing={h} onClose={() => setMemoHearingId(null)} /> : null;
        })()}

        {/* Transcript split view — full screen overlay */}
        {transcriptHearingId && (() => {
          const h = hearings.find((x) => x.event_id === transcriptHearingId) ?? allHearings.find((x) => x.event_id === transcriptHearingId);
          return h ? <TranscriptSplitView hearing={h} onClose={() => setTranscriptHearingId(null)} /> : null;
        })()}
      </div>
    </div>
  );
}
