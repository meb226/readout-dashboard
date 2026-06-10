/**
 * Memo renderer + client lens (ML-63).
 *
 * Generic path (no client selected) renders the memo markdown exactly
 * as before. When the user picks a client profile from the dropdown,
 * we fetch that client's relevance annotations and weave them into the
 * memo as expandable numbered footnotes — the memo text itself is
 * never altered, markers are interleaved BETWEEN paragraphs (see
 * utils/annotateMemo.ts for the anchoring logic).
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Markdown, { type Components } from "react-markdown";
import { fetchMemo } from "../api/client";
import { useClients } from "../hooks/useClients";
import {
  useAnnotations,
  useGenerateAnnotations,
} from "../hooks/useAnnotations";
import { annotateMemo, type PlacedAnnotation } from "../utils/annotateMemo";
import type { RelevanceAnnotation } from "../types/api";

/** What the parent needs to know to offer "Include client notes" on
 *  the .docx download: the active client + their generated notes. */
export interface MemoLens {
  clientName: string;
  annotations: RelevanceAnnotation[];
}

interface MemoViewerProps {
  eventId: string;
  /**
   * Optional: called whenever the active lens changes — null for
   * generic view or when no notes exist yet. Parents should pass a
   * useCallback-stable function to avoid extra effect runs.
   */
  onLensChange?: (lens: MemoLens | null) => void;
}

/* react-markdown component overrides — Inter headings, Lora body */
const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-heading text-[20px] font-bold tracking-tight text-[#1a1a1a] mb-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-heading text-[17px] font-bold tracking-tight mt-7 mb-1 text-[#1a1a1a]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-heading text-[14px] font-bold uppercase tracking-wider mt-6 mb-3 text-[#0039A6]">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="font-heading text-[13px] font-semibold mt-5 mb-2 text-[#444]">
      {children}
    </h4>
  ),
  hr: () => (
    <hr className="border-none h-px my-5" style={{ background: "linear-gradient(90deg, rgba(0,57,166,0.2), transparent)" }} />
  ),
  p: ({ children }) => (
    <p className="text-[15px] leading-[1.72] mb-3.5 text-[#333]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="pl-5 mb-3.5">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="text-[15px] leading-[1.72] mb-2.5 text-[#333]">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#1a1a1a]">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-[#0039A6] pl-4 py-3 my-4 bg-[rgba(0,57,166,0.03)] rounded-r-lg italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#f5f5f5]">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-[#e5e5e5]">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 font-semibold text-[#1a1a1a] text-xs">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-[#333] text-[13px]">{children}</td>
  ),
};

/* ── Annotation marker — numbered chip + expandable note card ───── */

function AnnotationMarker({
  placed,
  clientName,
}: {
  placed: PlacedAnnotation;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const { annotation, number } = placed;

  return (
    <div className="my-2 font-heading">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5"
        title={open ? "Collapse client note" : "Expand client note"}
      >
        {/* Numbered superscript-style chip — navy bg, white number. */}
        <span
          className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none"
          style={{ background: "#0039A6", verticalAlign: "super" }}
        >
          {number}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: "#0039A6" }}>
          Client note
        </span>
      </button>

      {open && (
        // Inset card styled like the memo blockquotes: left navy bar.
        <div className="border-l-[3px] border-[#0039A6] pl-4 py-3 mt-1.5 bg-[rgba(0,57,166,0.03)] rounded-r-lg">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#0039A6" }}>
            {clientName} · {annotation.section}
          </div>
          <p className="text-[13px] leading-[1.65] text-[#333]">{annotation.blurb}</p>
        </div>
      )}
    </div>
  );
}

/* ── Endnotes — annotations whose anchor wasn't found in the memo ── */

function ClientEndnotes({
  endnotes,
  clientName,
}: {
  endnotes: PlacedAnnotation[];
  clientName: string;
}) {
  // Group by memo section so each note carries its intended context
  // even though we couldn't pin it to an exact paragraph.
  const bySection = new Map<string, PlacedAnnotation[]>();
  for (const placed of endnotes) {
    const key = placed.annotation.section || "General";
    const list = bySection.get(key);
    if (list) {
      list.push(placed);
    } else {
      bySection.set(key, [placed]);
    }
  }

  return (
    <div className="mt-8 pt-5 font-heading" style={{ borderTop: "1px solid rgba(0,57,166,0.15)" }}>
      <div className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: "#0039A6" }}>
        Client notes — {clientName}
      </div>
      {Array.from(bySection.entries()).map(([section, items]) => (
        <div key={section} className="mb-4">
          <div className="text-[11px] font-semibold text-[#666] uppercase tracking-wide mb-1.5">
            {section}
          </div>
          {items.map((placed) => (
            <div key={placed.number} className="flex items-start gap-2 mb-2">
              <span
                className="flex-shrink-0 w-[16px] h-[16px] rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none mt-0.5"
                style={{ background: "#0039A6" }}
              >
                {placed.number}
              </span>
              <p className="text-[13px] leading-[1.65] text-[#333]">
                {placed.annotation.blurb}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Lens status panel — generate / empty / stale states ─────────── */

function LensPanel({
  clientName,
  status,
  stale,
  annotationCount,
  generating,
  onGenerate,
}: {
  clientName: string;
  status: "ready" | "not_generated";
  stale: boolean;
  annotationCount: number;
  generating: boolean;
  onGenerate: (force: boolean) => void;
}) {
  // The generate POST is a synchronous Opus call (20-60s) — show an
  // explicit progress message so the wait doesn't read as a hang.
  if (generating) {
    return (
      <div className="mb-5 rounded-lg px-4 py-3 flex items-center gap-2.5 font-heading"
        style={{ background: "rgba(0,57,166,0.04)", border: "1px solid rgba(0,57,166,0.15)" }}>
        <span
          className="inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin flex-shrink-0"
          style={{ borderColor: "#0039A6", borderTopColor: "transparent" }}
        />
        <span className="text-[13px] text-[#333]">
          Reading the memo through {clientName}'s lens… ~30s
        </span>
      </div>
    );
  }

  if (status === "not_generated") {
    return (
      <div className="mb-5 rounded-lg px-4 py-3 font-heading"
        style={{ background: "rgba(0,57,166,0.04)", border: "1px solid rgba(0,57,166,0.15)" }}>
        <div className="text-[13px] text-[#333] mb-2">
          No client notes yet for <span className="font-semibold">{clientName}</span>.
        </div>
        <button
          type="button"
          onClick={() => onGenerate(false)}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: "#0039A6" }}
        >
          Generate client notes
        </button>
      </div>
    );
  }

  // status === "ready"
  return (
    <>
      {annotationCount === 0 && (
        <p className="mb-5 text-[13px] italic text-[#666] font-heading">
          This hearing doesn't appear to touch {clientName}'s lobbying priorities.
        </p>
      )}
      {stale && (
        <div className="mb-5 flex items-center gap-2 text-[12px] font-heading text-[#666]">
          <span>Profile updated since these notes were generated —</span>
          <button
            type="button"
            onClick={() => onGenerate(true)}
            className="font-semibold hover:underline"
            style={{ color: "#0039A6" }}
          >
            Regenerate
          </button>
        </div>
      )}
    </>
  );
}

/* ── Main viewer ──────────────────────────────────────────────────── */

export function MemoViewer({ eventId, onLensChange }: MemoViewerProps) {
  // NOTE: isPending, not isLoading — v5's isLoading is false on the
  // first render before the fetch fires (the ML-534 footgun).
  const { data: memo, isPending, error } = useQuery({
    queryKey: ["memo", eventId],
    queryFn: () => fetchMemo(eventId),
  });

  // ML-63: client lens. The profiles list is cheap and cached; the
  // selector hides entirely when the user has no profiles, so the
  // generic experience is unchanged for non-lens users.
  const clientsQuery = useClients();
  const profiles = clientsQuery.data?.clients ?? [];
  const [profileId, setProfileId] = useState<number | null>(null);
  const selectedProfile =
    profiles.find((p) => p.id === profileId) ?? null;

  const annotationsQuery = useAnnotations(
    eventId,
    selectedProfile ? selectedProfile.id : null,
  );
  const generate = useGenerateAnnotations(eventId);

  const lensData = selectedProfile ? annotationsQuery.data : undefined;
  const clientName =
    lensData?.client_display_name ?? selectedProfile?.display_name ?? "";

  // Inform the parent (download button area) about the active lens so
  // it can offer "Include client notes" on the .docx export.
  useEffect(() => {
    if (!onLensChange) return;
    if (
      selectedProfile &&
      lensData?.status === "ready" &&
      lensData.annotations.length > 0
    ) {
      onLensChange({ clientName, annotations: lensData.annotations });
    } else {
      onLensChange(null);
    }
  }, [onLensChange, selectedProfile, lensData, clientName]);

  // Anchor the annotations into the markdown. null = render the plain
  // generic memo (no client selected, or no notes to weave in).
  const annotated = useMemo(() => {
    if (!memo || !lensData || lensData.status !== "ready") return null;
    if (lensData.annotations.length === 0) return null;
    return annotateMemo(memo, lensData.annotations);
  }, [memo, lensData]);

  if (isPending) {
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
      <div className="py-6">
        <p className="text-sm text-red font-medium">Failed to load memo.</p>
      </div>
    );
  }

  if (!memo) return null;

  // No client profiles → exactly the pre-ML-63 markup, no extra
  // wrapper, no selector. Non-lens users see zero difference.
  if (profiles.length === 0) {
    return (
      <div className="font-serif max-w-none">
        <Markdown components={mdComponents}>{memo}</Markdown>
      </div>
    );
  }

  return (
    <div>
      {/* Client lens selector — hidden when the user has no profiles. */}
      {profiles.length > 0 && (
        <div className="mb-4 flex items-center gap-2 font-heading">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#666]">
            View
          </span>
          <select
            value={profileId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setProfileId(v === "" ? null : Number(v));
            }}
            className="text-[13px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer focus:outline-none"
            style={{
              border: "1px solid rgba(0,57,166,0.25)",
              color: "#0039A6",
              background: "white",
            }}
          >
            <option value="">Generic view</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} lens
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Lens status — fetching / generate / empty / stale. */}
      {selectedProfile && annotationsQuery.isPending && (
        <p className="mb-5 text-[12px] text-[#666] font-heading">
          Checking for client notes…
        </p>
      )}
      {selectedProfile && annotationsQuery.error && (
        <p className="mb-5 text-[12px] text-red font-heading">
          {annotationsQuery.error.message.includes("API 409")
            ? "This hearing's memo hasn't been generated yet."
            : `Couldn't load client notes: ${annotationsQuery.error.message}`}
        </p>
      )}
      {selectedProfile && generate.error && !generate.isPending && (
        <p className="mb-5 text-[12px] text-red font-heading">
          Couldn't generate client notes: {generate.error.message}
        </p>
      )}
      {selectedProfile && lensData && (
        <LensPanel
          clientName={clientName}
          status={lensData.status}
          stale={lensData.stale === true}
          annotationCount={lensData.annotations.length}
          generating={generate.isPending}
          onGenerate={(force) =>
            generate.mutate({ profileId: selectedProfile.id, force })
          }
        />
      )}

      {/* Memo body. Generic path (no lens notes) is byte-identical to
          the pre-ML-63 render: one Markdown pass over the whole memo. */}
      <div className="font-serif max-w-none">
        {annotated === null ? (
          <Markdown components={mdComponents}>{memo}</Markdown>
        ) : (
          <>
            {annotated.segments.map((seg, i) => (
              <Fragment key={i}>
                {seg.markdown.trim() !== "" && (
                  <Markdown components={mdComponents}>{seg.markdown}</Markdown>
                )}
                {seg.notes.map((placed) => (
                  <AnnotationMarker
                    key={placed.number}
                    placed={placed}
                    clientName={clientName}
                  />
                ))}
              </Fragment>
            ))}
            {annotated.endnotes.length > 0 && (
              <ClientEndnotes
                endnotes={annotated.endnotes}
                clientName={clientName}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
