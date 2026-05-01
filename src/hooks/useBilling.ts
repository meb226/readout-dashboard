/**
 * ML-537: billing summary hook + portal/checkout actions.
 *
 * Drives the QuotaCounter, the PaidConfirmModal copy ("card ending"
 * + "new monthly total"), and the TestModeBadge in the header.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchBillingSummary,
  openBillingPortal,
  startBaseCheckout,
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
