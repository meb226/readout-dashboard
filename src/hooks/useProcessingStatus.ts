import { useQuery } from "@tanstack/react-query";
import { fetchProcessingStatus } from "../api/client";

/**
 * Polls processing status every 2.5s while a hearing is actively
 * preparing or processing. Stops polling when done.
 */
export function useProcessingStatus(eventId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["processing-status", eventId],
    queryFn: () => fetchProcessingStatus(eventId!),
    enabled: !!eventId && enabled,
    refetchInterval: enabled ? 2500 : false,
  });
}
