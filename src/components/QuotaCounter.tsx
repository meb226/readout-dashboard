/**
 * ML-537: Quota counter for the picker.
 *
 * Always visible at the top of /settings/committees so the user sees
 * how many of their 3 included committees are used and what their
 * monthly bill is. Three states:
 *   - 0–3 included used: "X of 3 included"
 *   - 4+: "X committees · Y add-on(s) at $49/mo · $ZZZ/mo total"
 *   - Stripe not configured (early beta): "Billing not yet active"
 */

import type { BillingSummary } from "../types/api";

interface Props {
  summary: BillingSummary | undefined;
  loading: boolean;
}

function formatPrice(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function QuotaCounter({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div
        className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-faint"
        aria-busy="true"
      >
        Loading billing…
      </div>
    );
  }

  const {
    included_quota,
    included_used,
    addon_count,
    billed_addon_count,
    base_price_cents,
    addon_price_cents,
    monthly_total_cents,
    stripe_configured,
    payment_failed_at,
  } = summary;

  // Banner takes priority over the count when something's wrong.
  if (payment_failed_at) {
    return (
      <div
        className="rounded-lg border border-red bg-red-light px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-heading font-semibold text-red">
          Payment failed.
        </span>{" "}
        <span className="text-text-muted">
          Update your card via "Manage billing" to keep your committees active.
        </span>
      </div>
    );
  }

  if (!stripe_configured) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-muted">
        <span className="font-heading font-semibold">Billing not yet active.</span>{" "}
        All committees are free during the early-access window.
      </div>
    );
  }

  const isAtOrUnderQuota = addon_count === 0;
  const compCount = addon_count - billed_addon_count;

  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-4"
      style={{
        background: isAtOrUnderQuota
          ? "var(--color-navy-light)"
          : "var(--color-amber-light)",
        borderColor: isAtOrUnderQuota ? "var(--color-navy)" : "var(--color-amber)",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {isAtOrUnderQuota ? (
          <>
            <span className="font-heading font-semibold text-text">
              {included_used} of {included_quota} included
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">
              {formatPrice(base_price_cents)}/mo
            </span>
          </>
        ) : (
          <>
            <span className="font-heading font-semibold text-text">
              {included_used + addon_count} committees
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">
              {billed_addon_count} add-on{billed_addon_count === 1 ? "" : "s"} at{" "}
              {formatPrice(addon_price_cents)}/mo
              {compCount > 0 && (
                <span className="text-text-faint">
                  {" "}
                  (+{compCount} comp'd)
                </span>
              )}
            </span>
            <span className="text-text-muted">·</span>
            <span className="font-heading font-semibold text-text">
              {formatPrice(monthly_total_cents)}/mo total
            </span>
          </>
        )}
      </div>
    </div>
  );
}
