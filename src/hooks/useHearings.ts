import { useQuery } from "@tanstack/react-query";
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
    refetchInterval: 30_000, // Refresh list every 30s to pick up auto-prep changes
  });
}
