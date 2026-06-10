/**
 * Anchor client-relevance annotations into a memo's raw markdown (ML-63).
 *
 * The backend's Opus pass returns each annotation with an
 * `anchor_quote` — a verbatim excerpt of the memo passage the note is
 * about. We find that quote in the RAW markdown (before rendering),
 * locate the end of the paragraph containing it, and split the memo
 * into segments at those points. The MemoViewer then renders each
 * segment with ReactMarkdown and interleaves a numbered marker after
 * each anchored segment — so the memo body itself stays clean and the
 * notes read like expandable footnotes.
 *
 * WHY whitespace normalization: the quote inside the memo may wrap
 * across lines (markdown reflows freely), so an exact indexOf on the
 * raw string would miss it. We collapse every run of whitespace to a
 * single space on BOTH sides, keeping a char-by-char map back to the
 * original string so the match position survives the round trip.
 *
 * Annotations whose quote can't be found anywhere are NOT dropped —
 * they're returned as `endnotes` and rendered in a block at the bottom
 * of the memo, labeled with their section heading.
 */

import type { RelevanceAnnotation } from "../types/api";

/** An annotation plus its display number (1-based, document order). */
export interface PlacedAnnotation {
  annotation: RelevanceAnnotation;
  number: number;
}

/** A slice of the memo markdown, with any notes anchored at its end. */
export interface MemoSegment {
  markdown: string;
  notes: PlacedAnnotation[];
}

export interface AnnotatedMemo {
  segments: MemoSegment[];
  /** Annotations whose anchor couldn't be located in the memo text. */
  endnotes: PlacedAnnotation[];
}

/**
 * Collapse all whitespace runs to single spaces, remembering where
 * each normalized character came from in the original string.
 */
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = []; // map[i] = original index of norm[i]
  let lastWasSpace = true; // true at start → leading whitespace is trimmed
  for (let i = 0; i < s.length; i++) {
    if (/\s/.test(s[i])) {
      if (!lastWasSpace) {
        norm += " ";
        map.push(i);
        lastWasSpace = true;
      }
    } else {
      norm += s[i];
      map.push(i);
      lastWasSpace = false;
    }
  }
  return { norm, map };
}

/** Whitespace-collapse a quote for searching (also trims both ends). */
function normalizeQuote(q: string): string {
  return q.replace(/\s+/g, " ").trim();
}

export function annotateMemo(
  memo: string,
  annotations: RelevanceAnnotation[],
): AnnotatedMemo {
  const { norm, map } = normalizeWithMap(memo);

  // For each annotation, find the original-string offset where its
  // containing paragraph ends (the next "\n\n" after the match).
  // null = anchor not found → endnote.
  const splitPointOf: (number | null)[] = annotations.map((a) => {
    const needle = normalizeQuote(a.anchor_quote);
    if (!needle) return null;
    const idx = norm.indexOf(needle);
    if (idx === -1) return null;
    // Map the LAST character of the match back to the original string,
    // then walk forward to the paragraph boundary.
    const origEnd = map[idx + needle.length - 1];
    const paraEnd = memo.indexOf("\n\n", origEnd);
    return paraEnd === -1 ? memo.length : paraEnd;
  });

  // Group annotation indexes by split point (two notes can anchor in
  // the same paragraph), then order paragraphs by document position.
  const byPoint = new Map<number, number[]>();
  splitPointOf.forEach((point, annIdx) => {
    if (point === null) return;
    const list = byPoint.get(point) ?? [];
    list.push(annIdx);
    byPoint.set(point, list);
  });
  const sortedPoints = Array.from(byPoint.keys()).sort((x, y) => x - y);

  // Number annotations 1..N in reading order: anchored ones first (by
  // position in the memo), then unmatched ones in the endnotes block.
  let counter = 0;
  const segments: MemoSegment[] = [];
  let prev = 0;
  for (const point of sortedPoints) {
    segments.push({
      markdown: memo.slice(prev, point),
      notes: (byPoint.get(point) ?? []).map((annIdx) => ({
        annotation: annotations[annIdx],
        number: ++counter,
      })),
    });
    prev = point; // the "\n\n" itself leads the next segment — harmless
  }
  // Whatever remains after the last anchored paragraph.
  if (prev < memo.length) {
    segments.push({ markdown: memo.slice(prev), notes: [] });
  }

  const endnotes: PlacedAnnotation[] = [];
  splitPointOf.forEach((point, annIdx) => {
    if (point === null) {
      endnotes.push({ annotation: annotations[annIdx], number: ++counter });
    }
  });

  return { segments, endnotes };
}
