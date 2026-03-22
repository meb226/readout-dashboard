import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTranscript } from "../api/client";
import type { TranscriptUtterance, TranscriptData } from "../types/api";
import { downloadTranscriptAsDocx } from "../utils/transcriptToDocx";

interface TranscriptViewerProps {
  eventId: string;
  /** When true, the parent renders its own download buttons. */
  hideDownload?: boolean;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlight matching text. The currently-focused match gets a distinct style. */
function HighlightText({ text, query, matchIndices, currentMatchIndex }: {
  text: string; query: string; matchIndices: number[]; currentMatchIndex: number;
}) {
  if (!query.trim()) return <>{text}</>;

  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(regex);

  let matchCounter = matchIndices[0]; // starting index for matches in this text

  return (
    <>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          regex.lastIndex = 0; // reset after test
          const idx = matchCounter++;
          const isCurrent = idx === currentMatchIndex;
          return (
            <mark
              key={i}
              data-match-index={idx}
              className={`rounded-sm px-0.5 ${isCurrent ? "bg-[#ff9632] text-white" : "bg-[#fff3cd] text-inherit"}`}
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Group consecutive utterances by the same speaker into blocks. */
function groupBySpeaker(utterances: TranscriptUtterance[]) {
  const groups: { speaker_name: string; start: number; utterances: TranscriptUtterance[] }[] = [];

  for (const u of utterances) {
    const last = groups[groups.length - 1];
    if (last && last.speaker_name === u.speaker_name) {
      last.utterances.push(u);
    } else {
      groups.push({ speaker_name: u.speaker_name, start: u.start, utterances: [u] });
    }
  }

  return groups;
}

export { type TranscriptData };

export function useTranscript(eventId: string) {
  return useQuery({
    queryKey: ["transcript", eventId],
    queryFn: () => fetchTranscript(eventId),
    retry: false,
  });
}

export function TranscriptViewer({ eventId, hideDownload }: TranscriptViewerProps) {
  const [search, setSearch] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: transcript, isLoading, error } = useTranscript(eventId);

  // Count total matches across all utterances
  const totalMatches = useMemo(() => {
    if (!transcript || !search.trim()) return 0;
    const regex = new RegExp(escapeRegex(search), "gi");
    let count = 0;
    for (const u of transcript.utterances) {
      const matches = u.text.match(regex);
      if (matches) count += matches.length;
      const nameMatches = u.speaker_name.match(regex);
      if (nameMatches) count += nameMatches.length;
    }
    return count;
  }, [transcript, search]);

  // Build a map: for each utterance index, what's the starting match number
  const matchStartMap = useMemo(() => {
    if (!transcript || !search.trim()) return new Map<number, number>();
    const regex = new RegExp(escapeRegex(search), "gi");
    const map = new Map<number, number>();
    let running = 0;
    for (let i = 0; i < transcript.utterances.length; i++) {
      map.set(i, running);
      const u = transcript.utterances[i];
      const textMatches = u.text.match(regex);
      if (textMatches) running += textMatches.length;
      const nameMatches = u.speaker_name.match(regex);
      if (nameMatches) running += nameMatches.length;
    }
    return map;
  }, [transcript, search]);

  // Reset match index when search changes
  useEffect(() => { setCurrentMatch(0); }, [search]);

  // Scroll to current match
  useEffect(() => {
    if (totalMatches === 0) return;
    const el = containerRef.current?.querySelector(`[data-match-index="${currentMatch}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentMatch, totalMatches]);

  const goNext = useCallback(() => {
    setCurrentMatch((c) => (c + 1) % totalMatches);
  }, [totalMatches]);

  const goPrev = useCallback(() => {
    setCurrentMatch((c) => (c - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  // Keyboard: Enter = next, Shift+Enter = prev
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && totalMatches > 0) {
      e.preventDefault();
      if (e.shiftKey) goPrev(); else goNext();
    }
  }, [totalMatches, goNext, goPrev]);

  const groups = useMemo(() => groupBySpeaker(transcript?.utterances ?? []), [transcript]);

  const handleDownload = useCallback(async () => {
    if (!transcript) return;
    const filename = `transcript_${eventId}.docx`;
    await downloadTranscriptAsDocx(transcript, filename);
  }, [transcript, eventId]);

  if (isLoading) {
    return (
      <div className="py-6 space-y-4 animate-pulse">
        <div className="h-4 rounded bg-black/5" style={{ width: "85%" }} />
        <div className="h-4 rounded bg-black/5" style={{ width: "70%" }} />
        <div className="h-4 rounded bg-black/5" style={{ width: "60%" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <p className="text-sm text-text-faint">Transcript not available.</p>
      </div>
    );
  }

  if (!transcript || transcript.utterances.length === 0) return null;

  const isSearching = search.trim().length > 0;

  return (
    <div>
      {/* Search bar + nav + download */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search transcript..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-8 pr-28 py-1.5 text-sm border border-border rounded-md bg-bg font-heading placeholder:text-text-faint/60 focus:outline-none focus:ring-1 focus:ring-navy/30 focus:border-navy/40"
          />
          {isSearching && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <span className="text-[11px] font-semibold text-text-faint tabular-nums mr-1">
                {totalMatches > 0 ? `${currentMatch + 1} of ${totalMatches}` : "0 results"}
              </span>
              <button
                onClick={goPrev}
                disabled={totalMatches === 0}
                className="w-5 h-5 flex items-center justify-center rounded text-text-faint hover:text-text hover:bg-black/5 disabled:opacity-30 disabled:cursor-default transition-colors"
                title="Previous match (Shift+Enter)"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={goNext}
                disabled={totalMatches === 0}
                className="w-5 h-5 flex items-center justify-center rounded text-text-faint hover:text-text hover:bg-black/5 disabled:opacity-30 disabled:cursor-default transition-colors"
                title="Next match (Enter)"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {!hideDownload && (
          <button
            onClick={handleDownload}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-white transition-opacity hover:opacity-80"
            style={{ background: "#0039A6" }}
            title="Download as .docx"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
            </svg>
            .docx
          </button>
        )}
      </div>

      {/* Utterances */}
      <div className="space-y-4" ref={containerRef}>
        {groups.length === 0 && (
          <p className="text-sm text-text-faint py-2">No utterances.</p>
        )}

        {groups.map((group, gi) => {
          // Compute the match-index offset for utterances in this group
          const groupUtteranceIndices = group.utterances.map((u) => {
            const globalIdx = transcript!.utterances.indexOf(u);
            return matchStartMap.get(globalIdx) ?? 0;
          });

          return (
            <div key={`${group.speaker_name}-${group.start}-${gi}`}>
              {/* Speaker header */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-heading text-sm font-semibold text-navy">
                  {group.speaker_name || `Speaker ${group.utterances[0].speaker}`}
                </span>
                <span className="text-xs text-text-faint">
                  {formatTimestamp(group.start)}
                </span>
              </div>

              {/* Utterance text */}
              {group.utterances.map((u, ui) => (
                <p
                  key={`${u.start}-${ui}`}
                  className="font-serif text-[15px] leading-[1.72] text-[#333] mb-1"
                >
                  {isSearching ? (
                    <HighlightText
                      text={u.text}
                      query={search}
                      matchIndices={[groupUtteranceIndices[ui]]}
                      currentMatchIndex={currentMatch}
                    />
                  ) : (
                    u.text
                  )}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      {transcript && (
        <div className="mt-3 pt-2 border-t border-border">
          <p className="text-xs text-text-faint">
            {transcript.utterances.length} utterances &middot;{" "}
            {transcript.num_speakers} speakers &middot;{" "}
            {Math.round(transcript.duration_seconds / 60)} min
          </p>
        </div>
      )}
    </div>
  );
}
