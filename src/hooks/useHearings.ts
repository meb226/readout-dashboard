import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchHearings } from "../api/client";

export function useHearings(params: {
  committee_id?: string;
  status?: string;
  offset?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["hearings", params],
    queryFn: () => fetchHearings(params),
    staleTime: 60_000, // Cache stays fresh for 1 min — avoids refetch flash on remount
    placeholderData: keepPreviousData, // Keep previous results visible while new query loads
    refetchInterval: 30_000, // Refresh list every 30s to pick up auto-prep changes
  });
}
