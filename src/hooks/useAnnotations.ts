/**
 * Client relevance annotations for one (hearing, client profile) pair
 * (ML-63).
 *
 * The GET is cheap (reads a stored result or says "not_generated").
 * The POST is a synchronous Opus call server-side (20-60s), so it's a
 * long-lived mutation — the UI shows an explicit "Reading the memo…"
 * message while it runs. On success we write the response straight
 * into the query cache (setQueryData) instead of invalidating, so the
 * fresh notes appear without a second network round-trip.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAnnotations, generateAnnotations } from "../api/client";
import type { AnnotationsResponse } from "../types/api";

export function useAnnotations(eventId: string, profileId: number | null) {
  return useQuery<AnnotationsResponse, Error>({
    // null profileId (generic view) disables the query entirely —
    // the generic memo path makes zero annotation requests.
    queryKey: ["annotations", eventId, profileId],
    queryFn: () => fetchAnnotations(eventId, profileId as number),
    enabled: profileId !== null,
    staleTime: 60 * 1000,
    // A 409 (hearing has no memo yet) won't fix itself by retrying.
    retry: false,
  });
}

export function useGenerateAnnotations(eventId: string) {
  const qc = useQueryClient();
  return useMutation<
    AnnotationsResponse,
    Error,
    { profileId: number; force?: boolean }
  >({
    mutationFn: ({ profileId, force = false }) =>
      generateAnnotations(eventId, profileId, force),
    onSuccess: (data, { profileId }) => {
      qc.setQueryData(["annotations", eventId, profileId], data);
    },
  });
}
