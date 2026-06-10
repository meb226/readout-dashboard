/**
 * Client relevance profiles — state + mutations (ML-63).
 *
 * Mirrors the useSubscriptions pattern: one list query keyed
 * ["clients"], and create/update/refresh/delete mutations that all
 * invalidate that key so every consumer (settings page, MemoViewer's
 * lens dropdown) stays in sync without manual refetches.
 *
 * The LDA search itself is a mutation (not a query) because it's a
 * slow POST the user explicitly triggers — we never want React Query
 * to refire a 20-second LDA crawl in the background.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  deleteClient,
  fetchClients,
  ldaSearch,
  refreshClient,
  updateClient,
} from "../api/client";
import type { ClientProfile, LdaSearchResponse } from "../types/api";

const CLIENTS_KEY = ["clients"] as const;

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: fetchClients,
    staleTime: 60 * 1000,
  });
}

function invalidateClients(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CLIENTS_KEY });
  // Profile edits (cluster toggles, refresh) can make existing
  // annotations stale — drop every cached annotations result so the
  // memo lens refetches and sees the server's `stale: true` flag.
  qc.invalidateQueries({ queryKey: ["annotations"] });
}

/** Slow LDA preview search — no cache invalidation, it changes nothing. */
export function useLdaSearch() {
  return useMutation<
    LdaSearchResponse,
    Error,
    { registrant_name: string; search_type: "registrant" | "client" }
  >({
    mutationFn: (params) => ldaSearch(params),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation<
    ClientProfile,
    Error,
    {
      display_name: string;
      registrant_name: string;
      search_type: "registrant" | "client";
      selected_issue_codes: string[];
    }
  >({
    mutationFn: (body) => createClient(body),
    onSuccess: () => invalidateClients(qc),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation<
    ClientProfile,
    Error,
    { id: number; display_name?: string; selected_issue_codes?: string[] }
  >({
    mutationFn: ({ id, ...body }) => updateClient(id, body),
    onSuccess: () => invalidateClients(qc),
  });
}

/** Re-runs the LDA search server-side — slow (~5-20s), like the preview. */
export function useRefreshClient() {
  const qc = useQueryClient();
  return useMutation<ClientProfile, Error, number>({
    mutationFn: (id) => refreshClient(id),
    onSuccess: () => invalidateClients(qc),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, number>({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => invalidateClients(qc),
  });
}
