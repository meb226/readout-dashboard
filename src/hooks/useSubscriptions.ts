/**
 * ML-532: Subscription state + mutations.
 *
 * Backed by ML-529 endpoints. Subscribing a committee with zero prior
 * subscribers triggers a 30-day Phase B backfill on the server, plus
 * unarchive of any hearings hidden on a previous last-subscriber drop.
 * The mutation result surfaces these counts so the UI can show a
 * concrete "queued N hearings" toast.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSubscriptions,
  subscribeToCommittee,
  unsubscribeFromCommittee,
} from "../api/client";
import type {
  SubscribeResponse,
  UnsubscribeResponse,
} from "../types/api";

const SUBSCRIPTIONS_KEY = ["subscriptions"] as const;

export function useSubscriptions() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_KEY,
    queryFn: fetchSubscriptions,
    staleTime: 30 * 1000,
  });
}

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation<SubscribeResponse, Error, string>({
    mutationFn: (committeeId: string) => subscribeToCommittee(committeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
      // Backfill may queue hearings — refresh the dashboard's hearing
      // list so the user sees their committee's hearings appear.
      qc.invalidateQueries({ queryKey: ["hearings"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUnsubscribe() {
  const qc = useQueryClient();
  return useMutation<UnsubscribeResponse, Error, string>({
    mutationFn: (committeeId: string) => unsubscribeFromCommittee(committeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
      // Last-subscriber-out archives the committee's hearings — refresh
      // the dashboard so they disappear from the active view.
      qc.invalidateQueries({ queryKey: ["hearings"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
