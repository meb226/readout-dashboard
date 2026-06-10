/**
 * TypeScript types matching src/api/models.py exactly.
 *
 * ML-65: These drive the dashboard's data layer.
 */

export const HearingStatus = {
  DETECTED: "detected",
  RESOLVED: "resolved",
  PREPARING: "preparing",
  READY: "ready",
  PROCESSING: "processing",
  COMPLETE: "complete",
  FAILED: "failed",
  POSTPONED: "postponed",
  CANCELED: "canceled",
} as const;

export type HearingStatus = (typeof HearingStatus)[keyof typeof HearingStatus];

export interface HearingListItem {
  event_id: string;
  committee_id: string;
  committee_name: string;
  title: string;
  hearing_date: string;
  hearing_type: string;
  meeting_status: string;
  status: HearingStatus;
  video_url: string | null;
  video_source_type: string | null;
  hearing_id: string | null;
  has_audio_brief: boolean;
  has_video: boolean;
  has_transcript: boolean;
  detected_at: string;
  congress_gov_url: string;
  auto_process: boolean;
}

export interface HearingListResponse {
  hearings: HearingListItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface StageDetail {
  stage_name: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error: string | null;
}

export interface HearingDetail {
  event_id: string;
  committee_id: string;
  committee_name: string;
  system_code: string;
  title: string;
  hearing_date: string;
  hearing_type: string;
  meeting_status: string;
  congress_gov_url: string;
  video_urls: string[];
  detected_at: string;
  status: HearingStatus;
  video_url: string | null;
  video_source_type: string | null;
  resolved_at: string | null;
  hearing_id: string | null;
  has_audio_brief: boolean;
  has_video: boolean;
  has_transcript: boolean;
  stages: StageDetail[];
  briefs: Record<string, unknown>;
  retry_reason: string | null;
}

export interface ProcessingStatus {
  event_id: string;
  hearing_id: string | null;
  status: string;
  phase: string | null;
  current_stage: string | null;
  stages: StageDetail[];
  progress_percent: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface CommitteeCount {
  committee_id: string;
  committee_name: string;
  count: number;
}

export interface DashboardStats {
  total_hearings: number;
  resolved_count: number;
  preparing_count: number;
  ready_count: number;
  processing_count: number;
  complete_count: number;
  failed_count: number;
  by_committee: CommitteeCount[];
}

export interface TranscriptUtterance {
  speaker: number;
  speaker_name: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  /** ML-227: "R" / "D" for committee members, null for witnesses or unrecognized speakers. */
  party?: string | null;
}

export interface TranscriptData {
  duration_seconds: number;
  num_speakers: number;
  utterances: TranscriptUtterance[];
}

export interface CommitteeInfo {
  committee_id: string;
  name: string;
  short_name: string;
  chamber: string;
  congress_gov_code: string;
  video_source_type: string;
  priority: string;
  member_count: number;
}

// ML-62: Transcript search types

export interface TranscriptSearchHit {
  event_id: string;
  turn_index: number;
  speaker_name: string;
  party: string | null;
  start_time: number;
  end_time: number;
  snippet: string;
  rank: number;
  hearing_title: string;
  committee_id: string;
  committee_name: string;
  hearing_date: string;
}

export interface TranscriptSearchResponse {
  hits: TranscriptSearchHit[];
  total: number;
  query: string;
  offset: number;
  limit: number;
}

export interface ContextTurn {
  turn_index: number;
  speaker_name: string;
  party: string | null;
  text: string;
  start_time: number;
  end_time: number;
  is_match: boolean;
}

export interface ContextResponse {
  event_id: string;
  hearing_title: string;
  committee_name: string;
  hearing_date: string;
  turns: ContextTurn[];
  match_turn_index: number;
}

// ML-529 / ML-532: Subscription management

export interface Subscription {
  committee_id: string;
  name: string;
}

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
}

export interface SubscribeResponse {
  subscribed: true;
  committee_id: string;
  was_first_subscriber: boolean;
  already_subscribed: boolean;
  unarchived: number;
  queued_backfill: number;
  skipped_paused: number;
  paused: boolean;
  started_at: string;
  // ML-537: present on confirm-paid responses, absent on free subscribes.
  paid?: boolean;
  charged_amount_cents?: number;
  admin_comped?: boolean;
}

// ML-537: returned in place of SubscribeResponse when the user is past
// the included quota and would owe money. Frontend opens the
// PaidConfirmModal instead of treating this as success.
export interface PaymentRequiredResponse {
  requires_payment: true;
  committee_id: string;
  charge_amount_cents: number;
  monthly_total_cents: number;
  card_last4: string | null;
  requires_billing_setup: boolean;
}

export type SubscribeOrPaymentRequired = SubscribeResponse | PaymentRequiredResponse;

export function isPaymentRequired(
  res: SubscribeOrPaymentRequired,
): res is PaymentRequiredResponse {
  return (res as PaymentRequiredResponse).requires_payment === true;
}

// ML-537: GET /api/billing/summary
export interface BillingSummary {
  included_quota: number;
  included_used: number;
  addon_count: number;
  billed_addon_count: number;
  base_price_cents: number;
  addon_price_cents: number;
  monthly_total_cents: number;
  card_last4: string | null;
  current_period_end: string | null;
  payment_failed_at: string | null;
  test_mode: boolean;
  stripe_configured: boolean;
  has_base_subscription: boolean;
}

// ML-63: Client relevance overlay
//
// A "client profile" is a saved LDA (Lobbying Disclosure Act) search —
// the firm or client org a lobbyist works for — plus which of its
// lobbying issue areas ("clusters") the user wants memos screened
// against. Annotations are short Opus-written notes pinned to memo
// passages explaining why that passage matters to the client.

/** One LDA issue area (e.g. "BAN — Banking") with supporting evidence. */
export interface IssueCluster {
  issue_code: string;
  issue_name: string;
  filing_count: number;
  bills: string[];
  descriptions: string[];
  government_entities: string[];
  lobbyists: string[];
}

export interface ClientProfile {
  id: number;
  workos_user_id: string;
  display_name: string;
  registrant_name: string;
  search_type: "registrant" | "client";
  /** Which clusters the user left active — drives annotation relevance. */
  selected_issue_codes: string[];
  clusters: IssueCluster[];
  last_refreshed: string | null;
  created_at: string;
  updated_at: string;
}

/** One client note pinned to a memo passage. */
export interface RelevanceAnnotation {
  /** Memo section heading the note belongs under (e.g. "Notable Exchanges"). */
  section: string;
  /** Verbatim memo excerpt the note is anchored to. */
  anchor_quote: string;
  /** The "why this matters to your client" text. */
  blurb: string;
}

/** POST /api/clients/lda-search — preview of clusters before saving. */
export interface LdaSearchResponse {
  registrant_name: string;
  search_type: "registrant" | "client";
  years: number[];
  filing_count: number;
  clusters: IssueCluster[];
}

export interface ClientsResponse {
  clients: ClientProfile[];
}

/**
 * GET/POST /api/hearings/{event_id}/annotations/{profile_id}.
 * `status: "not_generated"` means no Opus run has happened yet for this
 * (hearing, profile) pair. `stale: true` means the profile's clusters
 * changed after the notes were generated.
 */
export interface AnnotationsResponse {
  status: "ready" | "not_generated";
  stale?: boolean;
  annotations: RelevanceAnnotation[];
  client_display_name?: string;
  generated_at?: string;
  /** POST only: true when the server returned an existing result. */
  cached?: boolean;
}

export interface UnsubscribeResponse {
  unsubscribed: boolean;
  committee_id: string;
  was_last_subscriber: boolean;
  was_subscribed: boolean;
  // ML-537: present on every unsubscribe response — true if the row
  // dropped was admin-comped (so no Stripe sync happened).
  was_admin_comped?: boolean;
  archived: number;
  ended_at: string | null;
}
