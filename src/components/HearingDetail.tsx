import { useHearingDetail } from "../hooks/useHearingDetail";
import { HearingStatus } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { MemoViewer } from "./MemoViewer";
import { AudioPlayer } from "./AudioPlayer";
import { artifactUrl } from "../api/client";

interface HearingDetailProps {
  eventId: string;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const STAGE_LABELS: Record<string, string> = {
  ingest: "Download & Extract",
  transcribe: "Transcription",
  resolve_speakers: "Speaker Resolution",
  generate_memo: "Memo Generation",
};

export function HearingDetail({ eventId, onClose }: HearingDetailProps) {
  const { data: hearing, isLoading, error } = useHearingDetail(eventId);

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse text-text-muted">Loading hearing details...</div>
    );
  }

  if (error || !hearing) {
    return (
      <div className="p-6 text-red">Failed to load hearing details.</div>
    );
  }

  const isComplete = hearing.status === HearingStatus.COMPLETE;

  return (
    <div className="bg-surface border-l border-border overflow-y-auto h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <StatusBadge status={hearing.status} />
          <button
            onClick={onClose}
            className="text-text-faint hover:text-text transition-colors text-lg leading-none"
          >
            x
          </button>
        </div>
        <h2 className="text-lg font-semibold text-text font-heading leading-snug mb-1">
          {hearing.title}
        </h2>
        <p className="text-sm text-text-muted">
          {hearing.committee_name} &middot; {formatDate(hearing.hearing_date)}
          {hearing.hearing_type && hearing.hearing_type !== "Hearing" && (
            <> &middot; {hearing.hearing_type}</>
          )}
        </p>
        {hearing.congress_gov_url && (
          <a
            href={hearing.congress_gov_url}
            target="_blank"
            rel="noopener"
            className="text-xs text-navy hover:underline mt-1 inline-block"
          >
            View on Congress.gov
          </a>
        )}
      </div>

      {/* Pipeline stages */}
      {hearing.stages.length > 0 && (
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-faint font-heading mb-3">
            Pipeline Stages
          </h3>
          <div className="space-y-2">
            {hearing.stages.map((stage) => (
              <div key={stage.stage_name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: stage.error
                        ? "#C0452A"
                        : stage.completed_at
                          ? "#72A375"
                          : "#E0E0E0",
                    }}
                  />
                  <span className="text-sm text-text">
                    {STAGE_LABELS[stage.stage_name] ?? stage.stage_name}
                  </span>
                </div>
                {stage.duration_seconds != null && (
                  <span className="text-xs text-text-faint">
                    {stage.duration_seconds < 60
                      ? `${Math.round(stage.duration_seconds)}s`
                      : `${Math.round(stage.duration_seconds / 60)}m`}
                  </span>
                )}
                {stage.error && (
                  <span className="text-xs text-red">{stage.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deliverables */}
      {isComplete && (
        <div className="px-6 py-4 border-b border-border space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-faint font-heading mb-3">
            Deliverables
          </h3>

          <AudioPlayer
            src={artifactUrl(eventId, "briefs/generic/audio_brief.mp3")}
            label="Audio Brief (~2 min)"
          />

          <AudioPlayer
            src={artifactUrl(eventId, "briefs/generic/podcast_episode.mp3")}
            label="Podcast Episode (~5-8 min)"
          />

          <a
            href={artifactUrl(eventId, "video_highlights.mp4")}
            target="_blank"
            rel="noopener"
            className="block text-center px-3 py-2 text-sm font-semibold text-navy bg-navy-light rounded hover:bg-[rgba(0,57,166,0.15)] transition-colors font-heading"
          >
            Download Video Highlights
          </a>
        </div>
      )}

      {/* Memo */}
      {isComplete && (
        <div className="px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-faint font-heading mb-3">
            Briefing Memo
          </h3>
          <MemoViewer eventId={eventId} />
        </div>
      )}
    </div>
  );
}
