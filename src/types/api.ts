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
