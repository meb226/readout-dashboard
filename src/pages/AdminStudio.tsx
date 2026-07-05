/**
 * ML-329/ML-330/ML-331: Studio — the podcast + video editorial surface.
 *
 * Review Phase-B-complete hearings, generate the podcast episode or
 * video brief on demand, preview/QA them inline, then publish episodes
 * to the public RSS feed. Operator tooling in the AdminHearings style:
 * flat info-dense table, inline styles, inline confirmations (no modals).
 *
 * Data flow:
 *   - hearing list: same 3-page fetch as /admin/hearings, filtered to
 *     Phase-B-complete (has_audio_brief) rows
 *   - generation: POST studio generate-podcast / integration
 *     regenerate-video-brief, then poll the shared /status endpoint
 *     every 2.5s until the job is terminal
 *   - publish state: GET /api/admin/studio/feed-status (episode rows +
 *     feed URL + kill-switch booleans)
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminPills } from "../components/AdminPills";
import {
  artifactUrl,
  fetchCommittees,
  fetchHearings,
  fetchProcessingStatus,
  studioFeedStatus,
  studioGeneratePodcast,
  studioPublishEpisode,
  studioRegenerateVideoBrief,
  studioSetFreeEpisode,
  studioUnpublishEpisode,
  type FeedStatus,
  type PodcastEpisode,
} from "../api/client";
import type { HearingListItem } from "../types/api";

type SortColumn = "hearing_date" | "committee_name" | "title" | "podcast" | "video";
type SortDirection = "asc" | "desc";
type PodcastFilter = "all" | "none" | "ready" | "published";
type GenKind = "podcast" | "video";
type RowConfirmAction = "regen-podcast" | "regen-video" | "publish" | "unpublish";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ------------------------------------------------------------------
// Status pill
// ------------------------------------------------------------------

function Pill({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        color: "#fff",
        background: color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

type PodcastState = "none" | "generating" | "ready" | "published" | "failed";

function podcastPill(state: PodcastState, isFree: boolean) {
  switch (state) {
    case "generating":
      return <Pill label="Generating…" color="#7B5EA7" />;
    case "ready":
      return <Pill label="Ready" color="#0039A6" />;
    case "published":
      return isFree
        ? <Pill label="Published · Free" color="#72A375" title="In the public feed; the current free episode" />
        : <Pill label="Published" color="#72A375" />;
    case "failed":
      return <Pill label="Failed" color="#c44" />;
    default:
      return <Pill label="Not generated" color="#999" />;
  }
}

// ------------------------------------------------------------------
// Generation poller — one per actively-generating row
// ------------------------------------------------------------------

function useGenerationPoll(eventId: string | null, onDone: () => void) {
  // Poll the shared /status endpoint while a generation job runs.
  // Terminal states flip has_podcast/has_video_brief, at which point
  // the parent invalidates the hearing + feed queries.
  return useQuery({
    queryKey: ["studio-gen-status", eventId],
    queryFn: async () => {
      const s = await fetchProcessingStatus(eventId as string);
      if (s.status === "complete" || s.status === "failed") onDone();
      return s;
    },
    enabled: !!eventId,
    refetchInterval: 2500,
  });
}

// ------------------------------------------------------------------
// Expanded preview panel (ML-330)
// ------------------------------------------------------------------

function PreviewPanel({
  hearing,
  episode,
  generating,
  onRegen,
  confirming,
  setConfirming,
  publishMutation,
  unpublishMutation,
  freeMutation,
  podcastEnabled,
  videoBriefEnabled,
}: {
  hearing: HearingListItem;
  episode: PodcastEpisode | undefined;
  generating: GenKind | null;
  onRegen: (kind: GenKind) => void;
  confirming: RowConfirmAction | null;
  setConfirming: (a: RowConfirmAction | null) => void;
  publishMutation: (eventId: string) => void;
  unpublishMutation: (eventId: string) => void;
  freeMutation: (eventId: string, isFree: boolean) => void;
  podcastEnabled: boolean;
  videoBriefEnabled: boolean;
}) {
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptText, setScriptText] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState(false);

  const eventId = hearing.event_id;
  const published = !!episode?.published_at;

  const toggleScript = async () => {
    const next = !scriptOpen;
    setScriptOpen(next);
    if (next && scriptText === null && !scriptError) {
      try {
        const res = await fetch(artifactUrl(eventId, "briefs/generic/podcast_script.txt"), {
          credentials: "include",
        });
        if (!res.ok) throw new Error(String(res.status));
        setScriptText(await res.text());
      } catch {
        // R2 presigned redirect can fail CORS on fetch(); the new-tab
        // link below always works.
        setScriptError(true);
      }
    }
  };

  const confirmBtn = (action: RowConfirmAction, label: string, run: () => void, danger = false) =>
    confirming === action ? (
      <span style={{ display: "inline-flex", gap: 6 }}>
        <button style={{ ...btnStyle, background: danger ? "#c44" : "#0039A6", color: "#fff" }}
          onClick={() => { setConfirming(null); run(); }}>
          Confirm {label}
        </button>
        <button style={btnStyle} onClick={() => setConfirming(null)}>Cancel</button>
      </span>
    ) : (
      <button style={btnStyle} onClick={() => setConfirming(action)}>{label}</button>
    );

  return (
    <tr>
      <td colSpan={8} style={{ background: "#f7f9fc", padding: "16px 24px", borderBottom: "1px solid #e3e8ef" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          {/* ---- Podcast side ---- */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#667", marginBottom: 8 }}>
              Podcast episode
            </div>
            {hearing.has_podcast ? (
              <>
                <audio
                  controls
                  preload="none"
                  style={{ width: "100%", height: 36 }}
                  src={artifactUrl(eventId, "briefs/generic/podcast_episode.mp3")}
                />
                <div style={{ fontSize: 12, color: "#556", margin: "8px 0", fontFamily: MONO }}>
                  {episode ? (
                    <>
                      duration {fmtDuration(episode.duration_seconds)} · {fmtBytes(episode.file_bytes)}
                      {episode.episode_number != null && <> · episode #{episode.episode_number}</>}
                      {" · updated "}{fmtStamp(episode.updated_at)}
                      {published && <> · published {fmtStamp(episode.published_at)}</>}
                    </>
                  ) : (
                    <>episode metadata pending — regenerate to sync</>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button style={btnStyle} onClick={toggleScript}>
                    {scriptOpen ? "Hide script" : "View script"}
                  </button>
                  <a
                    href={artifactUrl(eventId, "briefs/generic/podcast_episode.mp3")}
                    target="_blank" rel="noopener"
                    style={{ ...btnStyle, textDecoration: "none", display: "inline-block" }}
                  >
                    Download MP3
                  </a>
                  <span title={podcastEnabled ? "Re-run podcast script + assembly (~$0.50)" : "Disabled by READOUT_DISABLE_PODCAST"}>
                    {podcastEnabled
                      ? confirmBtn("regen-podcast", "Regenerate", () => onRegen("podcast"))
                      : <button style={{ ...btnStyle, opacity: 0.5, cursor: "not-allowed" }} disabled>Regenerate</button>}
                  </span>
                  {/* Publish workflow (ML-331) */}
                  {episode && !published && (
                    <span title="Adds this episode to the public RSS feed (Apple/Spotify pick it up on their next crawl)">
                      {confirmBtn("publish", "Publish to feed", () => publishMutation(eventId))}
                    </span>
                  )}
                  {episode && published && (
                    <>
                      <span title="Removes the episode from the RSS feed; the enclosure URL stops serving">
                        {confirmBtn("unpublish", "Unpublish", () => unpublishMutation(eventId), true)}
                      </span>
                      <label style={{ fontSize: 12, color: "#334", display: "inline-flex", alignItems: "center", gap: 5 }}
                        title="Mark as the week's free episode (clears the flag on any other episode)">
                        <input
                          type="checkbox"
                          checked={episode.is_free_episode}
                          onChange={(e) => freeMutation(eventId, e.target.checked)}
                        />
                        Free episode
                      </label>
                    </>
                  )}
                </div>
                {scriptOpen && (
                  <div style={{ marginTop: 10 }}>
                    {scriptText !== null ? (
                      <pre style={{
                        maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                        fontSize: 12, background: "#fff", border: "1px solid #e3e8ef",
                        borderRadius: 6, padding: 12, fontFamily: MONO,
                      }}>{scriptText}</pre>
                    ) : scriptError ? (
                      <div style={{ fontSize: 12, color: "#667" }}>
                        Couldn't load inline —{" "}
                        <a href={artifactUrl(eventId, "briefs/generic/podcast_script.txt")} target="_blank" rel="noopener">
                          open the script in a new tab
                        </a>.
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#667" }}>Loading script…</div>
                    )}
                  </div>
                )}
              </>
            ) : generating === "podcast" ? (
              <div style={{ fontSize: 13, color: "#7B5EA7" }}>
                Generating episode — script, two-voice TTS, packaging (~2-4 min)…
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#667" }}>
                No episode yet. Use Generate in the table row.
              </div>
            )}
          </div>

          {/* ---- Video brief side ---- */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#667", marginBottom: 8 }}>
              Video brief (HeyGen)
            </div>
            {hearing.has_video_brief ? (
              <>
                <video
                  controls
                  preload="none"
                  style={{ width: "100%", maxHeight: 240, background: "#000", borderRadius: 6 }}
                  src={artifactUrl(eventId, "briefs/generic/video_brief.mp4")}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <a
                    href={artifactUrl(eventId, "briefs/generic/video_brief.mp4")}
                    target="_blank" rel="noopener"
                    style={{ ...btnStyle, textDecoration: "none", display: "inline-block" }}
                  >
                    Download MP4
                  </a>
                  <span title={videoBriefEnabled ? "Re-run script + HeyGen render + assembly (~$3-4)" : "Disabled by READOUT_DISABLE_VIDEO_BRIEF"}>
                    {videoBriefEnabled
                      ? confirmBtn("regen-video", "Regenerate", () => onRegen("video"), true)
                      : <button style={{ ...btnStyle, opacity: 0.5, cursor: "not-allowed" }} disabled>Regenerate</button>}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#889", marginTop: 6 }}>
                  Distribution is manual for now — download and upload to YouTube
                  (see the podcast distribution runbook).
                </div>
              </>
            ) : generating === "video" ? (
              <div style={{ fontSize: 13, color: "#7B5EA7" }}>
                Rendering video brief — HeyGen avatar segments + assembly (~6-10 min)…
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#667" }}>
                No video brief. Needs the hearing video downloaded (Phase B with
                video); generation costs ~$3-4 of HeyGen render.
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  border: "1px solid #c9d2de",
  borderRadius: 6,
  background: "#fff",
  color: "#223",
  cursor: "pointer",
};

// ------------------------------------------------------------------
// Feed status panel (ML-331)
// ------------------------------------------------------------------

function FeedPanel({ feed }: { feed: FeedStatus | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!feed) return null;

  const published = feed.episodes.filter((e) => e.published_at);

  return (
    <div style={{
      margin: "18px 0", padding: 16, border: "1px solid #e3e8ef",
      borderRadius: 8, background: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#223" }}>RSS feed</span>
        <code style={{ fontSize: 12, background: "#f2f4f7", padding: "3px 8px", borderRadius: 5, fontFamily: MONO }}>
          {feed.feed_url}
        </code>
        <button
          style={btnStyle}
          onClick={() => {
            navigator.clipboard.writeText(feed.feed_url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied ✓" : "Copy URL"}
        </button>
        <span style={{ fontSize: 12, color: "#556" }}>
          {feed.published_count} published / {feed.episode_count} generated
          {feed.last_published_at && <> · last publish {fmtStamp(feed.last_published_at)}</>}
        </span>
        {!feed.podcast_enabled && (
          <Pill label="Podcast generation disabled" color="#c44" title="READOUT_DISABLE_PODCAST is set on the backend" />
        )}
        {!feed.video_brief_enabled && (
          <Pill label="Video briefs disabled" color="#c44" title="READOUT_DISABLE_VIDEO_BRIEF is set on the backend" />
        )}
      </div>

      {published.length > 0 && (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#667" }}>
              <th style={feedTh}>#</th>
              <th style={feedTh}>Title</th>
              <th style={feedTh}>Committee</th>
              <th style={feedTh}>Duration</th>
              <th style={feedTh}>Published</th>
              <th style={feedTh}>Free</th>
            </tr>
          </thead>
          <tbody>
            {published
              .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
              .map((e) => (
                <tr key={e.event_id} style={{ borderTop: "1px solid #eef1f5" }}>
                  <td style={{ ...feedTd, fontFamily: MONO }}>{e.episode_number ?? "—"}</td>
                  <td style={{ ...feedTd, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.title}>
                    {e.title}
                  </td>
                  <td style={feedTd}>{e.committee_id}</td>
                  <td style={{ ...feedTd, fontFamily: MONO }}>{fmtDuration(e.duration_seconds)}</td>
                  <td style={feedTd}>{fmtStamp(e.published_at)}</td>
                  <td style={feedTd}>{e.is_free_episode ? "★" : ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const feedTh: React.CSSProperties = { padding: "4px 8px", fontWeight: 600 };
const feedTd: React.CSSProperties = { padding: "5px 8px", color: "#334" };

// ------------------------------------------------------------------
// The page
// ------------------------------------------------------------------

export function AdminStudio() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [podcastFilter, setPodcastFilter] = useState<PodcastFilter>("all");
  const [sort, setSort] = useState<SortState>({ column: "hearing_date", direction: "desc" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<RowConfirmAction | null>(null);
  // event_id → which generation kind is in flight (one at a time per
  // hearing — podcast and video share the process-job slot)
  const [generating, setGenerating] = useState<Record<string, GenKind>>({});

  const { data: committees } = useQuery({
    queryKey: ["committees"],
    queryFn: fetchCommittees,
    staleTime: 5 * 60_000,
  });

  const { data: feed } = useQuery({
    queryKey: ["studio-feed-status"],
    queryFn: studioFeedStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Same 3-page pull as AdminHearings — filtered below to Phase-B-complete.
  const { data: page1 } = useQuery({
    queryKey: ["admin-hearings", "page1"],
    queryFn: () => fetchHearings({ limit: 200, offset: 0 }),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
  const { data: page2 } = useQuery({
    queryKey: ["admin-hearings", "page2"],
    queryFn: () => fetchHearings({ limit: 200, offset: 200 }),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
  const { data: page3 } = useQuery({
    queryKey: ["admin-hearings", "page3"],
    queryFn: () => fetchHearings({ limit: 200, offset: 400 }),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });

  const episodesByEvent = useMemo(() => {
    const m = new Map<string, PodcastEpisode>();
    for (const e of feed?.episodes ?? []) m.set(e.event_id, e);
    return m;
  }, [feed]);

  const allRows = useMemo(() => {
    const merged = [
      ...(page1?.hearings ?? []),
      ...(page2?.hearings ?? []),
      ...(page3?.hearings ?? []),
    ];
    const seen = new Set<string>();
    // The studio only shows hearings whose Phase B artifacts exist —
    // everything else belongs on /admin/hearings first.
    return merged.filter((h) => {
      if (seen.has(h.event_id)) return false;
      seen.add(h.event_id);
      return h.has_audio_brief;
    });
  }, [page1, page2, page3]);

  const podcastState = (h: HearingListItem): PodcastState => {
    if (generating[h.event_id] === "podcast") return "generating";
    const ep = episodesByEvent.get(h.event_id);
    if (ep?.published_at) return "published";
    if (h.has_podcast) return "ready";
    return "none";
  };

  const filtered = useMemo(() => {
    let list = allRows;
    if (committeeFilter !== "all") list = list.filter((h) => h.committee_id === committeeFilter);
    if (podcastFilter !== "all") {
      list = list.filter((h) => {
        const st = podcastState(h);
        if (podcastFilter === "none") return st === "none";
        if (podcastFilter === "ready") return st === "ready";
        return st === "published";
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) => h.title.toLowerCase().includes(q) || h.committee_name.toLowerCase().includes(q),
      );
    }
    const dir = sort.direction === "asc" ? 1 : -1;
    const stateRank: Record<PodcastState, number> = {
      published: 0, ready: 1, generating: 2, failed: 3, none: 4,
    };
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case "hearing_date":
          cmp = a.hearing_date.localeCompare(b.hearing_date);
          break;
        case "committee_name":
          cmp = a.committee_name.localeCompare(b.committee_name);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "podcast":
          cmp = stateRank[podcastState(a)] - stateRank[podcastState(b)];
          break;
        case "video":
          cmp = Number(b.has_video_brief) - Number(a.has_video_brief);
          break;
      }
      return cmp * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, committeeFilter, podcastFilter, search, sort, episodesByEvent, generating]);

  const handleSort = (column: SortColumn) =>
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: column === "hearing_date" ? "desc" : "asc" },
    );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-hearings"] });
    queryClient.invalidateQueries({ queryKey: ["hearings"] });
    queryClient.invalidateQueries({ queryKey: ["studio-feed-status"] });
  };

  // ---- Generation mutations ----
  const generatePodcast = useMutation({
    mutationFn: studioGeneratePodcast,
    onSuccess: (resp) => {
      setGenerating((g) => ({ ...g, [resp.event_id]: "podcast" }));
    },
    onError: (e: Error) => window.alert(`Generate podcast failed: ${e.message}`),
  });

  const generateVideo = useMutation({
    mutationFn: studioRegenerateVideoBrief,
    onSuccess: (resp) => {
      setGenerating((g) => ({ ...g, [resp.event_id]: "video" }));
    },
    onError: (e: Error) => window.alert(`Generate video brief failed: ${e.message}`),
  });

  // ---- Publish workflow mutations ----
  const publish = useMutation({
    mutationFn: studioPublishEpisode,
    onSuccess: (ep) => {
      invalidate();
      window.alert(`Published "${ep.title}" as episode #${ep.episode_number}.\nLive in the feed on the next fetch.`);
    },
    onError: (e: Error) => window.alert(`Publish failed: ${e.message}`),
  });
  const unpublish = useMutation({
    mutationFn: studioUnpublishEpisode,
    onSuccess: () => invalidate(),
    onError: (e: Error) => window.alert(`Unpublish failed: ${e.message}`),
  });
  const setFree = useMutation({
    mutationFn: ({ eventId, isFree }: { eventId: string; isFree: boolean }) =>
      studioSetFreeEpisode(eventId, isFree),
    onSuccess: () => invalidate(),
    onError: (e: Error) => window.alert(`Free-episode toggle failed: ${e.message}`),
  });

  return (
    <>
      <AdminPills current="readout" />
      <div style={{ padding: "24px 32px", fontFamily: "Inter, sans-serif", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Studio</h1>
          <span style={{ fontSize: 13, color: "#667" }}>
            review → generate → preview → publish
          </span>
        </div>

        <FeedPanel feed={feed} />

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, margin: "0 0 12px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="Search title or committee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "6px 10px", fontSize: 13, border: "1px solid #c9d2de",
              borderRadius: 6, width: 260,
            }}
          />
          <select
            value={committeeFilter}
            onChange={(e) => setCommitteeFilter(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #c9d2de", borderRadius: 6 }}
          >
            <option value="all">All committees</option>
            {(committees ?? []).map((c) => (
              <option key={c.committee_id} value={c.committee_id}>{c.name}</option>
            ))}
          </select>
          <select
            value={podcastFilter}
            onChange={(e) => setPodcastFilter(e.target.value as PodcastFilter)}
            style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #c9d2de", borderRadius: 6 }}
          >
            <option value="all">All podcast states</option>
            <option value="none">Not generated</option>
            <option value="ready">Ready (unpublished)</option>
            <option value="published">Published</option>
          </select>
          <span style={{ fontSize: 12, color: "#667" }}>
            {filtered.length} Phase-B-complete hearing{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff", border: "1px solid #e3e8ef", borderRadius: 8 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#556", background: "#f7f9fc" }}>
              <Th onClick={() => handleSort("hearing_date")} active={sort.column === "hearing_date"} dir={sort.direction}>Date</Th>
              <Th onClick={() => handleSort("committee_name")} active={sort.column === "committee_name"} dir={sort.direction}>Committee</Th>
              <Th onClick={() => handleSort("title")} active={sort.column === "title"} dir={sort.direction}>Title</Th>
              <th style={thStyle}>Memo</th>
              <th style={thStyle}>Brief</th>
              <Th onClick={() => handleSort("podcast")} active={sort.column === "podcast"} dir={sort.direction}>Podcast</Th>
              <Th onClick={() => handleSort("video")} active={sort.column === "video"} dir={sort.direction}>Video brief</Th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => {
              const eventId = h.event_id;
              const ep = episodesByEvent.get(eventId);
              const st = podcastState(h);
              const genKind = generating[eventId] ?? null;
              const isExpanded = expanded === eventId;
              return (
                <StudioRow
                  key={eventId}
                  hearing={h}
                  episode={ep}
                  state={st}
                  genKind={genKind}
                  isExpanded={isExpanded}
                  onToggle={() => {
                    setExpanded(isExpanded ? null : eventId);
                    setConfirming(null);
                  }}
                  onGenerate={(kind) => {
                    if (kind === "podcast") generatePodcast.mutate(eventId);
                    else generateVideo.mutate(eventId);
                  }}
                  onGenerationDone={() => {
                    setGenerating((g) => {
                      const next = { ...g };
                      delete next[eventId];
                      return next;
                    });
                    invalidate();
                  }}
                  confirming={isExpanded ? confirming : null}
                  setConfirming={setConfirming}
                  publishMutation={(id) => publish.mutate(id)}
                  unpublishMutation={(id) => unpublish.mutate(id)}
                  freeMutation={(id, f) => setFree.mutate({ eventId: id, isFree: f })}
                  podcastEnabled={feed?.podcast_enabled ?? true}
                  videoBriefEnabled={feed?.video_brief_enabled ?? true}
                />
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#889" }}>
                  No Phase-B-complete hearings match. Process hearings on{" "}
                  <a href="/admin/hearings">/admin/hearings</a> first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: "nowrap",
};

function Th({ children, onClick, active, dir }: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDirection;
}) {
  return (
    <th style={{ ...thStyle, cursor: "pointer", userSelect: "none" }} onClick={onClick}>
      {children}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function StudioRow({
  hearing,
  episode,
  state,
  genKind,
  isExpanded,
  onToggle,
  onGenerate,
  onGenerationDone,
  confirming,
  setConfirming,
  publishMutation,
  unpublishMutation,
  freeMutation,
  podcastEnabled,
  videoBriefEnabled,
}: {
  hearing: HearingListItem;
  episode: PodcastEpisode | undefined;
  state: PodcastState;
  genKind: GenKind | null;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerate: (kind: GenKind) => void;
  onGenerationDone: () => void;
  confirming: RowConfirmAction | null;
  setConfirming: (a: RowConfirmAction | null) => void;
  publishMutation: (eventId: string) => void;
  unpublishMutation: (eventId: string) => void;
  freeMutation: (eventId: string, isFree: boolean) => void;
  podcastEnabled: boolean;
  videoBriefEnabled: boolean;
}) {
  // Poll the shared status endpoint while this row has a job in flight.
  const poll = useGenerationPoll(genKind ? hearing.event_id : null, onGenerationDone);
  const pollError = genKind && poll.data?.status === "failed" ? poll.data?.error : null;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ borderTop: "1px solid #eef1f5", cursor: "pointer", background: isExpanded ? "#f0f4fa" : undefined }}
      >
        <td style={{ ...tdStyle, whiteSpace: "nowrap", fontFamily: MONO }}>
          {hearing.hearing_date?.slice(0, 10)}
        </td>
        <td style={tdStyle}>{hearing.committee_name}</td>
        <td style={{ ...tdStyle, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={hearing.title}>
          {hearing.title}
        </td>
        <td style={tdStyle}>✅</td>
        <td style={tdStyle}>{hearing.has_audio_brief ? "✅" : "—"}</td>
        <td style={tdStyle}>
          {podcastPill(state, episode?.is_free_episode ?? false)}
          {pollError && genKind === "podcast" && (
            <div style={{ fontSize: 11, color: "#c44", marginTop: 2 }} title={pollError}>failed — see panel</div>
          )}
        </td>
        <td style={tdStyle}>
          {genKind === "video"
            ? <Pill label="Rendering…" color="#7B5EA7" />
            : hearing.has_video_brief
              ? <Pill label="Ready" color="#0039A6" />
              : <Pill label="None" color="#999" />}
        </td>
        <td style={{ ...tdStyle, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
          {state === "none" && !genKind && (
            <button
              style={{ ...btnStyle, background: podcastEnabled ? "#0039A6" : "#eee", color: podcastEnabled ? "#fff" : "#999", cursor: podcastEnabled ? "pointer" : "not-allowed" }}
              disabled={!podcastEnabled}
              title={podcastEnabled ? "Generate the podcast episode (~$0.50, 2-4 min)" : "Disabled by READOUT_DISABLE_PODCAST"}
              onClick={() => onGenerate("podcast")}
            >
              Generate podcast
            </button>
          )}
          {!hearing.has_video_brief && !genKind && hearing.has_video && (
            <button
              style={{ ...btnStyle, marginLeft: 6 }}
              disabled={!videoBriefEnabled}
              title={videoBriefEnabled ? "Generate the HeyGen video brief (~$3-4, 6-10 min; needs the hearing video)" : "Disabled by READOUT_DISABLE_VIDEO_BRIEF"}
              onClick={() => onGenerate("video")}
            >
              Generate video
            </button>
          )}
          <button style={{ ...btnStyle, marginLeft: 6 }} onClick={onToggle}>
            {isExpanded ? "Close" : "Open"}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <PreviewPanel
          hearing={hearing}
          episode={episode}
          generating={genKind}
          onRegen={onGenerate}
          confirming={confirming}
          setConfirming={setConfirming}
          publishMutation={publishMutation}
          unpublishMutation={unpublishMutation}
          freeMutation={freeMutation}
          podcastEnabled={podcastEnabled}
          videoBriefEnabled={videoBriefEnabled}
        />
      )}
    </>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  color: "#223",
  verticalAlign: "top",
};
