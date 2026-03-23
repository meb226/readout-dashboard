/**
 * ML-62: Full-page transcript search with three-level zoom.
 *
 * Level 1: Search results list with highlighted snippets
 * Level 2: Context expansion (surrounding turns in accordion)
 * Level 3: Full transcript via TranscriptViewer (existing ML-227 component)
 */

import { useState, useCallback } from "react";
import { useTranscriptSearch, useSearchContext } from "../hooks/useTranscriptSearch";
import { useCommittees } from "../hooks/useCommittees";
import type { TranscriptSearchHit, CommitteeInfo } from "../types/api";

// ─── Helpers ───

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

// 3-letter committee shortcodes for badges
function cid(committeeId: string): string {
  const map: Record<string, string> = {
    senate_banking: "SBC",
    senate_finance: "SFC",
    senate_judiciary: "SJC",
    senate_budget: "SBU",
    senate_appropriations: "SAP",
    senate_commerce: "SCO",
    house_finserv: "HFS",
    house_ways_means: "HWM",
    house_energy: "HEC",
    house_judiciary: "HJC",
    house_budget: "HBU",
    house_appropriations: "HAP",
    house_oversight: "HOC",
    joint_economic: "JEC",
  };
  return map[committeeId] || committeeId.slice(0, 3).toUpperCase();
}

function cidColor(committeeId: string): string {
  const map: Record<string, string> = {
    senate_banking: "#0039A6",
    senate_finance: "#1a6b3c",
    senate_judiciary: "#7B2D8E",
    senate_budget: "#2563EB",
    senate_appropriations: "#B45309",
    senate_commerce: "#0E7490",
    house_finserv: "#C0452A",
    house_ways_means: "#047857",
    house_energy: "#D97706",
    house_judiciary: "#6D28D9",
    house_budget: "#1D4ED8",
    house_appropriations: "#92400E",
    house_oversight: "#4338CA",
    joint_economic: "#059669",
  };
  return map[committeeId] || "#555";
}

// ─── Party pill ───

function PartyPill({ party }: { party: string | null }) {
  if (!party) return null;
  const colors = { R: { bg: "#FEE2E2", text: "#991B1B" }, D: { bg: "#DBEAFE", text: "#1E3A8A" } };
  const c = colors[party as "R" | "D"];
  if (!c) return null;
  return (
    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded" style={{ background: c.bg, color: c.text }}>
      {party}
    </span>
  );
}

// ─── Context Expansion (Level 2) ───

function ContextExpansion({
  eventId,
  turnIndex,
  onViewTranscript,
}: {
  eventId: string;
  turnIndex: number;
  onViewTranscript: (eventId: string, searchQuery: string) => void;
}) {
  const { data, isLoading } = useSearchContext(eventId, turnIndex);

  if (isLoading) {
    return (
      <div className="px-4 py-3 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-4 rounded bg-[#e8e8e8] animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-[#888] uppercase tracking-wider">Context</p>
        <button
          onClick={() => onViewTranscript(eventId, "")}
          className="text-xs font-semibold text-[#0039A6] hover:underline"
        >
          View Full Transcript
        </button>
      </div>
      <div className="space-y-2">
        {data.turns.map((turn) => (
          <div
            key={turn.turn_index}
            className="rounded-lg px-3 py-2 transition-colors"
            style={{
              background: turn.is_match ? "#FFF3CD" : "rgba(255,255,255,0.4)",
              borderLeft: turn.is_match ? "3px solid #F59E0B" : "3px solid transparent",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#0039A6]">{turn.speaker_name || "Unknown"}</span>
              <PartyPill party={turn.party} />
              <span className="text-[10px] text-[#999]">{formatTimestamp(turn.start_time)}</span>
            </div>
            <p className="text-sm leading-relaxed text-[#333]" style={{ fontFamily: "'Lora', serif" }}>
              {turn.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Search Result Card ───

function SearchResultCard({
  hit,
  isExpanded,
  onToggle,
  onViewTranscript,
}: {
  hit: TranscriptSearchHit;
  isExpanded: boolean;
  onToggle: () => void;
  onViewTranscript: (eventId: string, searchQuery: string) => void;
}) {
  const color = cidColor(hit.committee_id);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-white/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Committee badge */}
          <span
            className="flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold text-white mt-0.5"
            style={{ background: color }}
          >
            {cid(hit.committee_id)}
          </span>

          <div className="flex-1 min-w-0">
            {/* Hearing title + date */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#333] truncate">{hit.hearing_title}</span>
              <span className="text-[10px] text-[#999] flex-shrink-0">{formatDate(hit.hearing_date)}</span>
            </div>

            {/* Speaker + party */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-[#0039A6]">{hit.speaker_name || "Unknown"}</span>
              <PartyPill party={hit.party} />
              <span className="text-[10px] text-[#bbb]">{formatTimestamp(hit.start_time)}</span>
            </div>

            {/* Snippet with highlights */}
            <p
              className="text-sm leading-relaxed text-[#555]"
              style={{ fontFamily: "'Lora', serif" }}
              dangerouslySetInnerHTML={{ __html: hit.snippet }}
            />
          </div>

          {/* Expand chevron */}
          <svg
            className="w-4 h-4 text-[#bbb] flex-shrink-0 mt-1 transition-transform duration-200"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Level 2 context expansion */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <ContextExpansion
            eventId={hit.event_id}
            turnIndex={hit.turn_index}
            onViewTranscript={onViewTranscript}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

interface TranscriptSearchProps {
  initialQuery?: string;
  onBack: () => void;
  onOpenTranscript: (eventId: string) => void;
}

export function TranscriptSearch({ initialQuery = "", onBack, onOpenTranscript }: TranscriptSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [speaker, setSpeaker] = useState("");
  const [committeeId, setCommitteeId] = useState("");
  const [party, setParty] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const limit = 20;

  const { data: committees } = useCommittees();
  const { data, isLoading, isFetching } = useTranscriptSearch({
    q: query,
    speaker: speaker || undefined,
    committee_id: committeeId || undefined,
    party: party || undefined,
    offset,
    limit,
  });

  const handleViewTranscript = useCallback(
    (eventId: string, _searchQuery: string) => {
      onOpenTranscript(eventId);
    },
    [onOpenTranscript],
  );

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = Math.floor(offset / limit) + 1;

  // Count unique hearings in results
  const uniqueHearings = data ? new Set(data.hits.map((h) => h.event_id)).size : 0;

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#0039A6] mb-4 hover:underline"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </button>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOffset(0); setExpandedIdx(null); }}
            placeholder="Search all transcripts..."
            autoFocus
            className="w-full pl-10 pr-4 py-3 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0039A6]/30 transition-all"
            style={{
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.5)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setOffset(0); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#444] text-lg font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {/* Committee dropdown */}
        <select
          value={committeeId}
          onChange={(e) => { setCommitteeId(e.target.value); setOffset(0); }}
          className="text-xs px-3 py-2 rounded-lg bg-white/60 border border-white/40 focus:outline-none focus:border-[#0039A6] transition-colors"
          style={{ backdropFilter: "blur(10px)" }}
        >
          <option value="">All Committees</option>
          {committees?.map((c: CommitteeInfo) => (
            <option key={c.committee_id} value={c.committee_id}>{c.short_name}</option>
          ))}
        </select>

        {/* Speaker filter */}
        <input
          type="text"
          value={speaker}
          onChange={(e) => { setSpeaker(e.target.value); setOffset(0); }}
          placeholder="Speaker..."
          className="text-xs px-3 py-2 rounded-lg bg-white/60 border border-white/40 focus:outline-none focus:border-[#0039A6] transition-colors w-32"
          style={{ backdropFilter: "blur(10px)" }}
        />

        {/* Party toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/40" style={{ backdropFilter: "blur(10px)" }}>
          {[
            { value: "", label: "All" },
            { value: "D", label: "D" },
            { value: "R", label: "R" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setParty(opt.value); setOffset(0); }}
              className="text-xs px-3 py-2 font-semibold transition-colors"
              style={{
                background: party === opt.value ? "rgba(0,57,166,0.1)" : "rgba(255,255,255,0.4)",
                color: party === opt.value ? "#0039A6" : "#666",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Loading indicator */}
        {isFetching && (
          <div className="w-4 h-4 border-2 border-[#0039A6]/30 border-t-[#0039A6] rounded-full animate-spin" />
        )}
      </div>

      {/* Results count */}
      {data && data.total > 0 && (
        <p className="text-xs font-bold text-[#888] uppercase tracking-wider mb-3">
          {data.total} result{data.total !== 1 ? "s" : ""} across {uniqueHearings} hearing{uniqueHearings !== 1 ? "s" : ""}
        </p>
      )}

      {/* Results list (Level 1) */}
      {data && data.hits.length > 0 && (
        <div className="space-y-2 mb-6">
          {data.hits.map((hit, idx) => (
            <SearchResultCard
              key={`${hit.event_id}-${hit.turn_index}`}
              hit={hit}
              isExpanded={expandedIdx === idx}
              onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              onViewTranscript={handleViewTranscript}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {data && data.hits.length === 0 && query.length >= 2 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.35)", border: "1px dashed rgba(0,57,166,0.12)" }}>
          <p className="text-sm font-medium text-[#666]">No transcript results for "{query}"</p>
          <p className="text-xs text-[#999] mt-1">Try different keywords or remove filters</p>
        </div>
      )}

      {/* Prompt to type */}
      {query.length < 2 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.25)" }}>
          <svg className="w-12 h-12 text-[#ddd] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
          </svg>
          <p className="text-sm text-[#888]">Search across all hearing transcripts</p>
          <p className="text-xs text-[#bbb] mt-1">Try "CFPB oversight", "stablecoin", or a member name</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && query.length >= 2 && (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{ background: "rgba(255,255,255,0.45)", animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-5 rounded bg-[#ddd]" />
                <div className="h-3 w-48 rounded bg-[#ddd]" />
                <div className="h-3 w-16 rounded bg-[#e8e8e8]" />
              </div>
              <div className="h-4 w-3/4 rounded bg-[#e8e8e8] mb-1" />
              <div className="h-4 w-1/2 rounded bg-[#e8e8e8]" />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.5)" }}
          >
            Previous
          </button>
          <span className="text-xs text-[#888] font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={!data || offset + limit >= data.total}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.5)" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
