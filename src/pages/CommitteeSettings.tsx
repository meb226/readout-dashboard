/**
 * Subscriber-facing committee picker.
 *
 * ML-532: pick committees, subscribe / unsubscribe, surface backfill
 *          counts via toast.
 * ML-537: quota gate. The first 3 committees are included in the
 *          $149/mo base; subscribing a 4th opens a confirm modal that
 *          charges $49 via Stripe before writing the DB row. Admins
 *          see a "skip payment" override link inside the modal.
 *          A QuotaCounter at the top always shows current usage.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCommittees } from "../hooks/useCommittees";
import {
  useSubscriptions,
  useSubscribe,
  useUnsubscribe,
  useConfirmPaidSubscribe,
  useAdminForceSubscribe,
} from "../hooks/useSubscriptions";
import {
  useBillingSummary,
  useAutoSyncBilling,
  redirectToBaseCheckout,
  redirectToBillingPortal,
} from "../hooks/useBilling";
import { useAuth } from "../auth/AuthProvider";
import {
  isPaymentRequired,
  type CommitteeInfo,
  type PaymentRequiredResponse,
  type SubscribeResponse,
} from "../types/api";
import { Header } from "../components/Header";
import { QuotaCounter } from "../components/QuotaCounter";
import { PaidConfirmModal } from "../components/PaidConfirmModal";

interface ToastState {
  kind: "subscribe" | "unsubscribe" | "paid";
  committee: string;
  detail: string;
}

interface ModalState {
  committee: CommitteeInfo;
  payment: PaymentRequiredResponse;
  errorMessage: string | null;
}

const CHAMBER_ORDER = ["senate", "house", "joint"] as const;
const CHAMBER_LABEL: Record<string, string> = {
  senate: "Senate",
  house: "House",
  joint: "Joint",
};

function chamberLabel(chamber: string): string {
  return CHAMBER_LABEL[chamber.toLowerCase()] ?? chamber;
}

function buildSubscribeToast(
  committeeName: string,
  res: SubscribeResponse,
): ToastState {
  const parts: string[] = [];
  if (res.paid) {
    parts.push(`Added for $${(res.charged_amount_cents ?? 4900) / 100}.`);
  } else if (res.admin_comped) {
    parts.push("Added (admin-comped, no charge).");
  } else if (res.already_subscribed) {
    parts.push("Already subscribed.");
  } else if (res.was_first_subscriber) {
    parts.push("You're the first subscriber.");
  } else {
    parts.push("Subscribed.");
  }
  if (res.unarchived > 0) {
    parts.push(
      `Restored ${res.unarchived} archived hearing${res.unarchived === 1 ? "" : "s"}.`,
    );
  }
  if (res.queued_backfill > 0) {
    parts.push(
      `Queued ${res.queued_backfill} recent hearing${res.queued_backfill === 1 ? "" : "s"} (last 30 days).`,
    );
  }
  if (res.skipped_paused > 0) {
    parts.push(
      `${res.skipped_paused} backfill candidate${res.skipped_paused === 1 ? "" : "s"} waiting on auto-processor resume.`,
    );
  }
  if (
    res.was_first_subscriber &&
    res.queued_backfill === 0 &&
    res.unarchived === 0 &&
    res.skipped_paused === 0
  ) {
    parts.push("No recent hearings to backfill yet.");
  }
  return {
    kind: res.paid ? "paid" : "subscribe",
    committee: committeeName,
    detail: parts.join(" "),
  };
}

export function CommitteeSettings() {
  const committeesQuery = useCommittees();
  const subsQuery = useSubscriptions();
  const billingQuery = useBillingSummary();
  // ML-537: webhook fallback. If the user paid the $149 base via
  // Checkout but the webhook never fired (e.g., webhook secret not yet
  // configured on the backend), the dashboard would forever bounce
  // them through "Set up billing" instead of "Add for $49". This hook
  // detects the mismatch and asks the server to look the user up by
  // email and stamp the Stripe IDs onto the subscriber row. Idempotent
  // and safe to call when the user genuinely hasn't paid yet — the
  // server returns 404 and the hook swallows it.
  useAutoSyncBilling(
    billingQuery.data?.stripe_configured === true &&
      billingQuery.data?.has_base_subscription === false,
  );
  const { session } = useAuth();
  const subscribe = useSubscribe();
  const confirmPaid = useConfirmPaidSubscribe();
  const adminForce = useAdminForceSubscribe();
  const unsubscribe = useUnsubscribe();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  const subscribedSet = useMemo(
    () =>
      new Set(
        (subsQuery.data?.subscriptions ?? []).map((s) => s.committee_id),
      ),
    [subsQuery.data],
  );

  const grouped = useMemo(() => {
    const committees = committeesQuery.data ?? [];
    const buckets: Record<string, CommitteeInfo[]> = {};
    for (const c of committees) {
      const key = c.chamber.toLowerCase();
      (buckets[key] ??= []).push(c);
    }
    for (const k of Object.keys(buckets)) {
      buckets[k].sort((a, b) => a.name.localeCompare(b.name));
    }
    return buckets;
  }, [committeesQuery.data]);

  const isLoading = committeesQuery.isPending || subsQuery.isPending;
  const loadError = committeesQuery.error || subsQuery.error;

  // Frontend quota check is for button labeling only; the SERVER is the
  // source of truth and will paywall the 4th regardless of what we show.
  const totalActive = subscribedSet.size;
  const includedQuota = billingQuery.data?.included_quota ?? 3;
  const wouldBePaid = (committeeId: string): boolean => {
    if (subscribedSet.has(committeeId)) return false;
    return totalActive >= includedQuota;
  };

  async function handleToggle(committee: CommitteeInfo) {
    if (pendingId) return;
    setPendingId(committee.committee_id);
    try {
      if (subscribedSet.has(committee.committee_id)) {
        const res = await unsubscribe.mutateAsync(committee.committee_id);
        const parts: string[] = [];
        if (!res.was_subscribed) {
          parts.push("Already unsubscribed.");
        } else if (res.was_last_subscriber) {
          parts.push(
            `Unsubscribed. Archived ${res.archived} hearing${res.archived === 1 ? "" : "s"} (artifacts kept; resubscribe to restore).`,
          );
        } else {
          parts.push(
            "Unsubscribed. Other firms still subscribed; hearings remain active.",
          );
        }
        if (res.was_admin_comped) {
          parts.push("(was admin-comped — no Stripe sync.)");
        }
        setToast({
          kind: "unsubscribe",
          committee: committee.name,
          detail: parts.join(" "),
        });
      } else {
        const res = await subscribe.mutateAsync(committee.committee_id);
        if (isPaymentRequired(res)) {
          // Open the modal — DB unchanged; nothing to invalidate.
          setModal({ committee, payment: res, errorMessage: null });
          return;
        }
        setToast(buildSubscribeToast(committee.name, res));
      }
    } catch (err) {
      setToast({
        kind: "subscribe",
        committee: committee.name,
        detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setPendingId(null);
    }
  }

  // Modal handlers.
  async function handleConfirmPaid() {
    if (!modal) return;
    try {
      const res = await confirmPaid.mutateAsync(modal.committee.committee_id);
      setToast(buildSubscribeToast(modal.committee.name, res));
      setModal(null);
    } catch (err) {
      setModal({
        ...modal,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleAdminOverride() {
    if (!modal) return;
    try {
      const res = await adminForce.mutateAsync(modal.committee.committee_id);
      setToast(buildSubscribeToast(modal.committee.name, res));
      setModal(null);
    } catch (err) {
      setModal({
        ...modal,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSetupBilling() {
    try {
      await redirectToBaseCheckout();
    } catch (err) {
      if (modal) {
        setModal({
          ...modal,
          errorMessage:
            err instanceof Error
              ? `Couldn't start Checkout: ${err.message}`
              : String(err),
        });
      }
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <div className="text-xs font-heading font-semibold uppercase tracking-widest text-navy mb-2">
              Settings
            </div>
            <h2
              className="font-brand text-3xl font-extrabold tracking-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Committee subscriptions
            </h2>
            <p className="mt-2 text-sm text-text-faint max-w-2xl">
              Pick the committees your firm wants Readout to process.
              Your $149/mo base includes 3 committees; each additional
              committee is $49/mo. Subscribing a committee with no
              current subscribers queues memos and audio briefs for the
              last 30 days; unsubscribing the last firm archives that
              committee's briefs (your artifacts are kept).
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 ml-6">
            <Link
              to="/"
              className="text-xs font-heading font-semibold text-navy hover:underline whitespace-nowrap"
            >
              ← Back to dashboard
            </Link>
            {billingQuery.data?.has_base_subscription && (
              <button
                type="button"
                onClick={() => {
                  redirectToBillingPortal().catch((err) =>
                    setToast({
                      kind: "subscribe",
                      committee: "Billing",
                      detail: `Couldn't open portal: ${err instanceof Error ? err.message : String(err)}`,
                    }),
                  );
                }}
                className="text-xs font-heading font-semibold text-text-muted hover:text-navy hover:underline whitespace-nowrap"
              >
                Manage billing →
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <QuotaCounter
            summary={billingQuery.data}
            loading={billingQuery.isPending}
          />
        </div>

        {toast && (
          <div
            role="status"
            className="mb-6 rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3"
            style={{
              background:
                toast.kind === "paid"
                  ? "var(--color-amber-light)"
                  : toast.kind === "subscribe"
                    ? "var(--color-green-light)"
                    : "var(--color-navy-light)",
              borderColor:
                toast.kind === "paid"
                  ? "var(--color-amber)"
                  : toast.kind === "subscribe"
                    ? "var(--color-green)"
                    : "var(--color-navy)",
            }}
          >
            <div>
              <span className="font-semibold">{toast.committee}</span>
              <span className="text-text-muted"> — {toast.detail}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-text-faint hover:text-text leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {isLoading && (
          <div className="text-sm text-text-faint">Loading committees…</div>
        )}

        {loadError && !isLoading && (
          <div className="rounded-lg border border-red bg-red-light px-4 py-3 text-sm text-text">
            Couldn't load committees: {loadError.message}
          </div>
        )}

        {!isLoading && !loadError && (
          <>
            {subscribedSet.size === 0 && (
              <div
                className="mb-6 rounded-lg border border-dashed px-4 py-5 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface)",
                }}
              >
                <div className="font-heading font-semibold text-text mb-1">
                  No subscriptions yet.
                </div>
                <div className="text-text-muted">
                  Pick at least one committee below to start receiving
                  Readout briefs. We'll backfill the last 30 days of
                  hearings automatically.
                </div>
              </div>
            )}

            <div className="space-y-8">
              {CHAMBER_ORDER.filter((c) => grouped[c]?.length).map((chamber) => (
                <section key={chamber}>
                  <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
                    {chamberLabel(chamber)}
                  </h3>
                  <ul className="rounded-xl border border-border bg-surface overflow-hidden">
                    {grouped[chamber].map((committee, idx) => {
                      const isSubscribed = subscribedSet.has(
                        committee.committee_id,
                      );
                      const isPending = pendingId === committee.committee_id;
                      const wouldPay = wouldBePaid(committee.committee_id);
                      return (
                        <li
                          key={committee.committee_id}
                          className="flex items-center justify-between gap-4 px-4 py-3.5"
                          style={{
                            borderTop:
                              idx === 0 ? "none" : "1px solid var(--color-border)",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="font-heading font-semibold text-sm text-text truncate">
                              {committee.name}
                            </div>
                            <div className="text-xs text-text-faint mt-0.5">
                              {committee.member_count > 0 &&
                                `${committee.member_count} members · `}
                              {committee.short_name}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggle(committee)}
                            className="px-4 py-1.5 rounded-lg text-xs font-heading font-semibold transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
                            style={
                              isSubscribed
                                ? {
                                    background: "var(--color-green-light)",
                                    color: "var(--color-green)",
                                    border: "1px solid var(--color-green)",
                                  }
                                : wouldPay
                                  ? {
                                      background: "var(--color-amber-light)",
                                      color: "var(--color-amber)",
                                      border: "1px solid var(--color-amber)",
                                    }
                                  : {
                                      background: "var(--color-navy)",
                                      color: "white",
                                      border: "1px solid var(--color-navy)",
                                    }
                            }
                          >
                            {isPending
                              ? "…"
                              : isSubscribed
                                ? "Subscribed ✓"
                                : wouldPay
                                  ? "Add for $49/mo"
                                  : "Subscribe"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      <PaidConfirmModal
        open={modal !== null}
        committeeName={modal?.committee.name ?? ""}
        chargeCents={modal?.payment.charge_amount_cents ?? 4900}
        monthlyTotalCents={modal?.payment.monthly_total_cents ?? 0}
        cardLast4={modal?.payment.card_last4 ?? null}
        requiresBillingSetup={modal?.payment.requires_billing_setup ?? false}
        isAdmin={Boolean(session?.is_admin)}
        isPending={confirmPaid.isPending || adminForce.isPending}
        errorMessage={modal?.errorMessage ?? null}
        onConfirmPaid={handleConfirmPaid}
        onAdminOverride={handleAdminOverride}
        onSetupBilling={handleSetupBilling}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
