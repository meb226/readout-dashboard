/**
 * Subscription state + mutations.
 *
 * ML-532: standard subscribe/unsubscribe against ML-529's endpoints.
 * ML-537: subscribe is now a union response (free SubscribeResponse OR
 *         PaymentRequiredResponse for the 4th+). Adds confirm-paid +
 *         admin-force mutation hooks. All mutations invalidate the
 *         billing summary so the QuotaCounter stays in sync.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminForceSubscribe,
  confirmPaidSubscribe,
  fetchSubscriptions,
  subscribeToCommittee,
  unsubscribeFromCommittee,
} from "../api/client";
import type {
  SubscribeOrPaymentRequired,
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

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
  // Backfill can queue hearings; archive on unsubscribe-last hides them.
  qc.invalidateQueries({ queryKey: ["hearings"] });
  qc.invalidateQueries({ queryKey: ["stats"] });
  // ML-537: counter + modal copy come from /api/billing/summary.
  qc.invalidateQueries({ queryKey: ["billing-summary"] });
}

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation<SubscribeOrPaymentRequired, Error, string>({
    mutationFn: (committeeId: string) => subscribeToCommittee(committeeId),
    onSuccess: (res) => {
      // Only invalidate when the server actually subscribed — the
      // payment-required branch hasn't changed any DB state.
      if ("subscribed" in res) {
        invalidateAll(qc);
      }
    },
  });
}

/**
 * ML-537: confirm-paid mutation. Server charges $49 + bumps Stripe
 * quantity, then writes the DB row. Failure surfaces as Error in the
 * modal — we don't invalidate the cache on failure since nothing
 * changed.
 */
export function useConfirmPaidSubscribe() {
  const qc = useQueryClient();
  return useMutation<SubscribeResponse, Error, string>({
    mutationFn: (committeeId: string) => confirmPaidSubscribe(committeeId),
    onSuccess: () => invalidateAll(qc),
  });
}

/**
 * ML-537 Layer 2: admin force-add. No charge. The server enforces
 * is_admin, but the call should still only be wired into the modal
 * when session.is_admin is true so non-admins never see the link.
 */
export function useAdminForceSubscribe() {
  const qc = useQueryClient();
  return useMutation<SubscribeResponse, Error, string>({
    mutationFn: (committeeId: string) => adminForceSubscribe(committeeId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUnsubscribe() {
  const qc = useQueryClient();
  return useMutation<UnsubscribeResponse, Error, string>({
    mutationFn: (committeeId: string) => unsubscribeFromCommittee(committeeId),
    onSuccess: () => invalidateAll(qc),
  });
}
