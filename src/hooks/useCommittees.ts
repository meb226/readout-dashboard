import { useQuery } from "@tanstack/react-query";
import { fetchCommittees } from "../api/client";

export function useCommittees() {
  return useQuery({
    queryKey: ["committees"],
    queryFn: fetchCommittees,
    staleTime: 5 * 60 * 1000, // Committees rarely change
  });
}
