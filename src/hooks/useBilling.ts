/**
 * ML-537: billing summary hook + portal/checkout actions.
 *
 * Drives the QuotaCounter, the PaidConfirmModal copy ("card ending"
 * + "new monthly total"), and the TestModeBadge in the header.
 */

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBillingSummary,
  openBillingPortal,
  startBaseCheckout,
  syncAfterCheckout,
} from "../api/client";

const BILLING_SUMMARY_KEY = ["billing-summary"] as const;

export function useBillingSummary() {
  return useQuery({
    queryKey: BILLING_SUMMARY_KEY,
    queryFn: fetchBillingSummary,
    // Cheap query but reads card data through Stripe — staleTime keeps
    // it from refiring on every component mount. Mutations on the
    // subscription routes invalidate this key so the counter / modal
    // stay in sync with the picker.
    staleTime: 30 * 1000,
  });
}

/**
 * ML-537: webhook fallback. When the picker mounts and the billing
 * summary says the user has no base subscription but Stripe is
 * configured, fire `/api/billing/sync-after-checkout` once. The server
 * looks the user up by email and stamps the Stripe IDs onto the
 * subscriber row if it can find an active customer + sub.
 *
 * Why: the canonical path is the `checkout.session.completed` webhook,
 * but a missing or delayed webhook leaves the user stuck — they paid
 * the $149 but the dashboard keeps showing "Set up billing" on the
 * 4th committee. This sync attempt recovers them transparently.
 *
 * Idempotent and non-fatal. 404 (no customer) is the common "haven't
 * paid yet" case; we swallow it. Other errors logged but don't block.
 */
export function useAutoSyncBilling(shouldSync: boolean | undefined): void {
  const qc = useQueryClient();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!shouldSync) return;
    if (triedRef.current) return;
    triedRef.current = true;

    syncAfterCheckout()
      .then((res) => {
        if (res.synced) {
          qc.invalidateQueries({ queryKey: BILLING_SUMMARY_KEY });
        }
      })
      .catch((err) => {
        // 404 = no customer yet (common, not really an error).
        if (!String(err).includes("404")) {
          console.warn("[ml537] auto-sync after checkout failed:", err);
        }
      });
  }, [shouldSync, qc]);
}

/**
 * Redirect the browser to Stripe Customer Portal. Used by the
 * "Manage billing" link in the header.
 */
export async function redirectToBillingPortal(): Promise<void> {
  const { url } = await openBillingPortal();
  window.location.href = url;
}

/**
 * Redirect the browser to Stripe Checkout for the $149 base sub.
 * Used in the modal when `requires_billing_setup: true`.
 */
export async function redirectToBaseCheckout(): Promise<void> {
  const { url } = await startBaseCheckout();
  window.location.href = url;
}
