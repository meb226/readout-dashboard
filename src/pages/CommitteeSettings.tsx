/**
 * ML-532: Subscriber-facing committee picker.
 *
 * Self-serve UI where a beta subscriber chooses which committees their
 * firm wants Readout to process. Subscriptions drive the Phase B auto-
 * render gate from ML-529: a committee with at least one subscriber
 * runs the expensive Phase B pipeline on every new hearing; one with
 * zero subscribers has its prior artifacts archived.
 *
 * The first subscriber on a committee triggers a 30-day backfill on
 * the server (Phase B for hearings already past Phase A). We surface
 * that on success so the user knows hearings will start appearing.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCommittees } from "../hooks/useCommittees";
import {
  useSubscriptions,
  useSubscribe,
  useUnsubscribe,
} from "../hooks/useSubscriptions";
import type { CommitteeInfo, SubscribeResponse } from "../types/api";
import { Header } from "../components/Header";

interface ToastState {
  kind: "subscribe" | "unsubscribe";
  committee: string;
  detail: string;
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
  if (res.already_subscribed) {
    parts.push("Already subscribed.");
  } else if (res.was_first_subscriber) {
    parts.push("You're the first subscriber.");
  } else {
    parts.push("Subscribed.");
  }
  if (res.unarchived > 0) {
    parts.push(`Restored ${res.unarchived} archived hearing${res.unarchived === 1 ? "" : "s"}.`);
  }
  if (res.queued_backfill > 0) {
    parts.push(`Queued ${res.queued_backfill} recent hearing${res.queued_backfill === 1 ? "" : "s"} (last 30 days).`);
  }
  if (res.skipped_paused > 0) {
    parts.push(`${res.skipped_paused} backfill candidate${res.skipped_paused === 1 ? "" : "s"} waiting on auto-processor resume.`);
  }
  if (res.was_first_subscriber && res.queued_backfill === 0 && res.unarchived === 0 && res.skipped_paused === 0) {
    parts.push("No recent hearings to backfill yet.");
  }
  return {
    kind: "subscribe",
    committee: committeeName,
    detail: parts.join(" "),
  };
}

export function CommitteeSettings() {
  const committeesQuery = useCommittees();
  const subsQuery = useSubscriptions();
  const subscribe = useSubscribe();
  const unsubscribe = useUnsubscribe();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const subscribedSet = useMemo(
    () => new Set((subsQuery.data?.subscriptions ?? []).map((s) => s.committee_id)),
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
          parts.push("Unsubscribed. Other firms still subscribed; hearings remain active.");
        }
        setToast({ kind: "unsubscribe", committee: committee.name, detail: parts.join(" ") });
      } else {
        const res = await subscribe.mutateAsync(committee.committee_id);
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

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <div className="text-xs font-heading font-semibold uppercase tracking-widest text-navy mb-2">
              Settings
            </div>
            <h2 className="font-brand text-3xl font-extrabold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Committee subscriptions
            </h2>
            <p className="mt-2 text-sm text-text-faint max-w-2xl">
              Pick the committees your firm wants Readout to process.
              Subscribing a committee with no current subscribers queues
              memos and audio briefs for hearings from the last 30 days.
              Unsubscribing the last firm archives that committee's
              briefs (your artifacts are kept; resubscribe to restore).
            </p>
          </div>
          <Link
            to="/"
            className="text-xs font-heading font-semibold text-navy hover:underline whitespace-nowrap ml-6"
          >
            ← Back to dashboard
          </Link>
        </div>

        {toast && (
          <div
            role="status"
            className="mb-6 rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3"
            style={{
              background: toast.kind === "subscribe" ? "var(--color-green-light)" : "var(--color-navy-light)",
              borderColor: toast.kind === "subscribe" ? "var(--color-green)" : "var(--color-navy)",
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
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              >
                <div className="font-heading font-semibold text-text mb-1">No subscriptions yet.</div>
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
                      const isSubscribed = subscribedSet.has(committee.committee_id);
                      const isPending = pendingId === committee.committee_id;
                      return (
                        <li
                          key={committee.committee_id}
                          className="flex items-center justify-between gap-4 px-4 py-3.5"
                          style={{
                            borderTop: idx === 0 ? "none" : "1px solid var(--color-border)",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="font-heading font-semibold text-sm text-text truncate">
                              {committee.name}
                            </div>
                            <div className="text-xs text-text-faint mt-0.5">
                              {committee.member_count > 0 && `${committee.member_count} members · `}
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
    </div>
  );
}
