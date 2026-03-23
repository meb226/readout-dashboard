/**
 * ML-62: Hook for cross-hearing transcript search.
 *
 * Uses TanStack Query with debounced query string.
 * keepPreviousData keeps results visible during pagination/filter changes.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { searchTranscripts, fetchSearchContext } from "../api/client";

/** Debounce a string value by `delay` ms. */
function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export interface SearchFilters {
  q: string;
  speaker?: string;
  committee_id?: string;
  date_from?: string;
  date_to?: string;
  party?: string;
  offset?: number;
  limit?: number;
}

export function useTranscriptSearch(filters: SearchFilters) {
  const debouncedQuery = useDebounce(filters.q, 300);

  return useQuery({
    queryKey: ["transcript-search", { ...filters, q: debouncedQuery }],
    queryFn: () => searchTranscripts({ ...filters, q: debouncedQuery }),
    enabled: debouncedQuery.length >= 2, // Don't search for single chars
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useSearchContext(
  eventId: string | null,
  turnIndex: number | null,
  radius = 5,
) {
  return useQuery({
    queryKey: ["search-context", eventId, turnIndex, radius],
    queryFn: () =>
      fetchSearchContext({
        event_id: eventId!,
        turn_index: turnIndex!,
        radius,
      }),
    enabled: eventId !== null && turnIndex !== null,
    staleTime: 5 * 60_000, // Context doesn't change — cache 5 min
  });
}
