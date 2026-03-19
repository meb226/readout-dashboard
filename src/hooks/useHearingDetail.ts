import { useQuery } from "@tanstack/react-query";
import { fetchHearingDetail } from "../api/client";

export function useHearingDetail(eventId: string | null) {
  return useQuery({
    queryKey: ["hearing-detail", eventId],
    queryFn: () => fetchHearingDetail(eventId!),
    enabled: !!eventId,
  });
}
