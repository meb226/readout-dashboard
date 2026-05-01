/**
 * ML-537: Paid-confirm modal.
 *
 * Opens when subscribe returns `requires_payment: true` (4th+ committee).
 * Shows the exact dollar amount, new monthly total, and card on file
 * BEFORE charging — no silent upgrades, per the spec.
 *
 * Three states:
 *   1. requires_billing_setup: true   → primary CTA = "Set up billing"
 *      → redirects to Stripe Checkout for the $149 base. (User has
 *      no Stripe customer yet.)
 *   2. Normal paid add-on               → primary CTA = "Add for $49"
 *      → calls confirmPaidSubscribe.
 *   3. Admin override link              → only when session.is_admin.
 *      Bypasses Stripe via adminForceSubscribe.
 *
 * Anti-fat-finger: primary button is disabled for ~250ms after open.
 */

import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  committeeName: string;
  chargeCents: number;
  monthlyTotalCents: number;
  cardLast4: string | null;
  requiresBillingSetup: boolean;
  isAdmin: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onConfirmPaid: () => void;
  onAdminOverride: () => void;
  onSetupBilling: () => void;
  onCancel: () => void;
}

const PRIMARY_DEBOUNCE_MS = 250;

function formatPrice(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaidConfirmModal(props: Props) {
  const {
    open,
    committeeName,
    chargeCents,
    monthlyTotalCents,
    cardLast4,
    requiresBillingSetup,
    isAdmin,
    isPending,
    errorMessage,
    onConfirmPaid,
    onAdminOverride,
    onSetupBilling,
    onCancel,
  } = props;

  // Anti-fat-finger debounce — the primary button is disabled for the
  // first 250ms after open so a double-click on the underlying
  // Subscribe button can't blow through to the charge.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!open) {
      setArmed(false);
      return;
    }
    const t = window.setTimeout(() => setArmed(true), PRIMARY_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const primaryLabel = requiresBillingSetup
    ? "Set up billing"
    : `Add for ${formatPrice(chargeCents)}`;
  const primaryAction = requiresBillingSetup ? onSetupBilling : onConfirmPaid;
  const primaryDisabled = !armed || isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0, 0, 0, 0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paid-confirm-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface shadow-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div className="px-6 pt-5 pb-4">
          <h2
            id="paid-confirm-title"
            className="font-brand text-xl font-extrabold tracking-tight text-text"
          >
            Add {committeeName}?
          </h2>
        </div>

        <div className="px-6 pb-4 space-y-3 text-sm">
          {requiresBillingSetup ? (
            <div className="text-text-muted">
              Adding a 4th committee requires a base subscription. We'll
              take you to Stripe to set up your $149/mo base, then you
              can add this committee for{" "}
              <span className="font-heading font-semibold text-text">
                {formatPrice(chargeCents)}/mo
              </span>
              .
            </div>
          ) : (
            <>
              <div className="text-text-muted">
                This is a paid add-on beyond your 3 included committees.
              </div>
              <ul className="space-y-1 text-text">
                <li>
                  <span className="font-heading font-semibold">
                    {formatPrice(chargeCents)}
                  </span>{" "}
                  charged today
                </li>
                <li>
                  <span className="font-heading font-semibold">
                    {formatPrice(chargeCents)}/mo
                  </span>{" "}
                  on every billing date going forward
                </li>
                <li>
                  New monthly total:{" "}
                  <span className="font-heading font-semibold">
                    {formatPrice(monthlyTotalCents)}/mo
                  </span>
                </li>
              </ul>
              <div className="text-text-faint text-xs pt-1">
                {cardLast4
                  ? `Charged to card ending ${cardLast4}.`
                  : "Charged to your saved payment method."}
              </div>
            </>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="text-sm rounded-md border px-3 py-2"
              style={{
                background: "var(--color-red-light)",
                borderColor: "var(--color-red)",
                color: "var(--color-text)",
              }}
            >
              {errorMessage}
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm font-heading font-semibold text-text-muted hover:text-text disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={primaryAction}
            disabled={primaryDisabled}
            className="px-4 py-2 rounded-lg text-sm font-heading font-semibold text-white disabled:opacity-50 disabled:cursor-wait"
            style={{ background: "var(--color-navy)" }}
          >
            {isPending ? "Charging…" : primaryLabel}
          </button>
        </div>

        {isAdmin && !requiresBillingSetup && (
          <div
            className="px-6 py-3 text-xs"
            style={{
              borderTop: "1px solid var(--color-border)",
              background: "var(--color-amber-light)",
            }}
          >
            <button
              type="button"
              onClick={onAdminOverride}
              disabled={isPending}
              className="font-heading font-semibold underline disabled:opacity-50"
              style={{ color: "var(--color-amber)" }}
            >
              Admin: skip payment and add for free
            </button>
            <span className="text-text-faint ml-2">
              (writes admin_comped row, no Stripe call)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
