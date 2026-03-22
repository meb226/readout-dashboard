/**
 * ML-311: Fetch keyword occurrence counts from hearing transcripts.
 *
 * Batches requests for all title-matched hearings. Returns a map of
 * eventId → {keyword: count}. Only fetches for hearings whose title
 * contains at least one keyword (pre-filtered by caller).
 */

import { useQueries } from "@tanstack/react-query";
import { fetchKeywordCounts } from "../api/client";

export function useKeywordCounts(
  matchedEventIds: string[],
  keywords: string[],
) {
  const results = useQueries({
    queries: matchedEventIds.map((eventId) => ({
      queryKey: ["keyword-counts", eventId, keywords],
      queryFn: () => fetchKeywordCounts(eventId, keywords),
      staleTime: 5 * 60 * 1000, // Transcript doesn't change — cache 5 min
      enabled: keywords.length > 0,
    })),
  });

  // Build lookup: eventId → {keyword: count}
  const counts = new Map<string, Record<string, number>>();
  matchedEventIds.forEach((eventId, i) => {
    if (results[i]?.data) {
      counts.set(eventId, results[i].data);
    }
  });

  return counts;
}
