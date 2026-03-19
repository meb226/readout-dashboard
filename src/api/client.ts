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

// --- Artifacts ---

export function artifactUrl(eventId: string, artifactPath: string): string {
  return `${API_BASE}/api/hearings/${eventId}/artifacts/${artifactPath}`;
}

// --- Stats & Committees ---

export async function fetchStats(): Promise<DashboardStats> {
  return apiFetch("/api/stats");
}

export async function fetchCommittees(): Promise<CommitteeInfo[]> {
  return apiFetch("/api/committees");
}
