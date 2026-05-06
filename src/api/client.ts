/**
 * Typed API client for the Readout FastAPI backend.
 *
 * ML-65: One function per endpoint.
 * ML-327/ML-224: Every request sends `credentials: 'include'` so the
 * shared .meridianlogic.ai session cookie travels cross-subdomain.
 * On a 401, we bounce the user to /login (which itself redirects to
 * the backend's /auth/login → WorkOS AuthKit).
 *
 * Same-origin always. Vercel rewrites in vercel.json proxy /api/* to
 * the Railway backend in production; vite.config.ts proxies it to
 * localhost:8000 in dev.
 */

import type {
  HearingListResponse,
  HearingDetail,
  ProcessingStatus,
  DashboardStats,
  CommitteeInfo,
  TranscriptData,
  TranscriptSearchResponse,
  ContextResponse,
  SubscriptionsResponse,
  SubscribeResponse,
  UnsubscribeResponse,
  SubscribeOrPaymentRequired,
  BillingSummary,
} from "../types/api";

const API_BASE = "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  // 401 → session expired or never existed. Bounce to /login.
  // We avoid throwing here so React Query's error handlers don't all
  // need to special-case auth — the page redirects before they run.
  // The /login path itself is exempt: it has no API calls.
  if (res.status === 401 && typeof window !== "undefined") {
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    // Throw so callers know the promise didn't resolve normally.
    throw new Error("Unauthenticated");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Hearings ---

export async function fetchHearings(params: {
  committee_id?: string;
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<HearingListResponse> {
  const qs = new URLSearchParams();
  if (params.committee_id) qs.set("committee_id", params.committee_id);
  if (params.status) qs.set("status", params.status);
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));

  const query = qs.toString();
  return apiFetch(`/api/hearings${query ? `?${query}` : ""}`);
}

export async function fetchHearingDetail(eventId: string): Promise<HearingDetail> {
  return apiFetch(`/api/hearings/${eventId}`);
}

// --- Processing ---

export async function triggerProcessing(
  eventId: string,
  downloadVideo = false,
): Promise<ProcessingStatus> {
  return apiFetch(`/api/hearings/${eventId}/process`, {
    method: "POST",
    body: JSON.stringify({ download_video: downloadVideo }),
  });
}

export async function fetchProcessingStatus(eventId: string): Promise<ProcessingStatus> {
  return apiFetch(`/api/hearings/${eventId}/status`);
}

// --- Memo ---

export async function fetchMemo(eventId: string): Promise<string> {
  const data = await apiFetch<{ content: string }>(`/api/hearings/${eventId}/memo`);
  return data.content;
}

// --- Transcript ---

export async function fetchTranscript(eventId: string): Promise<TranscriptData> {
  // ML-227: Use the dedicated transcript endpoint which enriches each
  // utterance with a `party` indicator (R / D / null) by cross-referencing
  // the speaker against the committee roster.
  return apiFetch(`/api/hearings/${eventId}/transcript`);
}

// --- Artifacts ---

export function artifactUrl(eventId: string, artifactPath: string): string {
  return `${API_BASE}/api/hearings/${eventId}/artifacts/${artifactPath}`;
}

// --- Keyword Counts (ML-311) ---

export async function fetchKeywordCounts(
  eventId: string,
  keywords: string[],
): Promise<Record<string, number>> {
  const qs = new URLSearchParams({ keywords: keywords.join(",") });
  return apiFetch(`/api/hearings/${eventId}/keyword-counts?${qs}`);
}

// --- Stats & Committees ---

export async function fetchStats(): Promise<DashboardStats> {
  return apiFetch("/api/stats");
}

export async function fetchCommittees(): Promise<CommitteeInfo[]> {
  return apiFetch("/api/committees");
}

// --- Flag toggle (ML-308) ---

export async function toggleHearingFlag(eventId: string): Promise<{ event_id: string; auto_process: boolean }> {
  return apiFetch(`/api/hearings/${eventId}/flag`, { method: "POST" });
}

// --- Transcript search (ML-62) ---

export async function searchTranscripts(params: {
  q: string;
  speaker?: string;
  committee_id?: string;
  date_from?: string;
  date_to?: string;
  party?: string;
  offset?: number;
  limit?: number;
}): Promise<TranscriptSearchResponse> {
  const qs = new URLSearchParams();
  qs.set("q", params.q);
  if (params.speaker) qs.set("speaker", params.speaker);
  if (params.committee_id) qs.set("committee_id", params.committee_id);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.party) qs.set("party", params.party);
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));

  return apiFetch(`/api/search?${qs.toString()}`);
}

export async function fetchSearchContext(params: {
  event_id: string;
  turn_index: number;
  radius?: number;
}): Promise<ContextResponse> {
  const qs = new URLSearchParams();
  qs.set("event_id", params.event_id);
  qs.set("turn_index", String(params.turn_index));
  if (params.radius !== undefined) qs.set("radius", String(params.radius));

  return apiFetch(`/api/search/context?${qs.toString()}`);
}

// --- Subscriptions (ML-529 / ML-532) ---

export async function fetchSubscriptions(): Promise<SubscriptionsResponse> {
  return apiFetch("/api/subscriptions");
}

// ML-537: subscribe response is now a union — server returns either
// the standard SubscribeResponse (free) or PaymentRequiredResponse
// (would-be 4th+ committee). Caller checks via isPaymentRequired().
export async function subscribeToCommittee(
  committeeId: string,
): Promise<SubscribeOrPaymentRequired> {
  return apiFetch(`/api/subscriptions/${committeeId}`, { method: "POST" });
}

// ML-537: confirm-paid runs the full Stripe charge → DB write atomic
// path. Returns the standard SubscribeResponse plus paid: true and
// charged_amount_cents, OR throws on charge failure (mapped to 402
// server-side, which the apiFetch error handler turns into an Error
// the modal renders verbatim).
export async function confirmPaidSubscribe(
  committeeId: string,
): Promise<SubscribeResponse> {
  return apiFetch(`/api/subscriptions/${committeeId}/confirm-paid`, {
    method: "POST",
  });
}

// ML-537 Layer 2: admin-only ops bypass — inserts admin_comped row
// without any Stripe call. Routed through /api/admin so non-admins
// 403 server-side regardless of any frontend gating.
export async function adminForceSubscribe(
  committeeId: string,
): Promise<SubscribeResponse> {
  return apiFetch(`/api/admin/subscriptions/${committeeId}/force`, {
    method: "POST",
  });
}

export async function unsubscribeFromCommittee(
  committeeId: string,
): Promise<UnsubscribeResponse> {
  return apiFetch(`/api/subscriptions/${committeeId}`, { method: "DELETE" });
}

// --- Billing (ML-537) ---

export async function fetchBillingSummary(): Promise<BillingSummary> {
  return apiFetch("/api/billing/summary");
}

export async function startBaseCheckout(): Promise<{ url: string }> {
  return apiFetch("/api/billing/checkout-base", { method: "POST" });
}

export async function openBillingPortal(): Promise<{ url: string }> {
  return apiFetch("/api/billing/portal", { method: "POST" });
}

// ML-537: webhook fallback. Idempotent — already-synced rows return
// `already_synced: true`.
export interface SyncAfterCheckoutResponse {
  synced: boolean;
  already_synced: boolean;
  customer_id: string | null;
  subscription_id: string | null;
  status: string | null;
}

export async function syncAfterCheckout(): Promise<SyncAfterCheckoutResponse> {
  return apiFetch("/api/billing/sync-after-checkout", { method: "POST" });
}

// --- Admin hearing force-run (ML-535) ---

export interface AdminActionResponse {
  event_id: string;
  action: string;
  job_status: string;
  hearing_id: string | null;
  manifest_cleared?: boolean;
  phase_a_preserved?: boolean;
}

export interface AdminHearingState {
  event_id: string;
  hearing_id: string | null;
  hearing: Record<string, unknown>;
  resolution: Record<string, unknown> | null;
  prep_job: {
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
    hearing_id: string | null;
  } | null;
  process_job: {
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
    hearing_id: string | null;
  } | null;
  manifest: {
    hearing_id: string;
    is_prep_complete: boolean;
    is_background_complete: boolean;
    stages: Record<string, {
      completed_at: string | null;
      duration_seconds: number | null;
      error: string | null;
    }>;
  } | null;
}

export async function adminForcePrep(eventId: string): Promise<AdminActionResponse> {
  return apiFetch(`/api/admin/hearings/${eventId}/prep`, { method: "POST" });
}

export async function adminForceProcess(eventId: string): Promise<AdminActionResponse> {
  return apiFetch(`/api/admin/hearings/${eventId}/process`, { method: "POST" });
}

export async function adminRerunPhaseB(eventId: string): Promise<AdminActionResponse> {
  return apiFetch(`/api/admin/hearings/${eventId}/rerun`, { method: "POST" });
}

export async function adminFetchHearingState(eventId: string): Promise<AdminHearingState> {
  return apiFetch(`/api/admin/hearings/${eventId}/state`);
}
