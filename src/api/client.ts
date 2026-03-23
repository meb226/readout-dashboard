/**
 * Typed API client for the Readout FastAPI backend.
 *
 * ML-65: One function per endpoint. Base URL from VITE_API_URL env var.
 * The optional `token` parameter is unused now but ready for ML-224 (Clerk auth).
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
} from "../types/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

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
  const url = artifactUrl(eventId, "transcript_attributed.json");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
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
