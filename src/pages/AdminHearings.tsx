/**
 * ML-535: Admin force-run view for any hearing in any state.
 *
 * Lists every hearing in a flat info-dense table. Per-row buttons fire
 * the corresponding admin endpoint. Designed for "find this hearing
 * and force it through stage X right now" — operator + debugging tool,
 * not customer-facing UI.
 *
 * v1 deferrals (separate follow-up):
 *  - Resolver force-run for DETECTED hearings (no button shown)
 *  - Manual video-URL override
 *  - Date-range filter (title search + committee + status filters land in v1.1)
 *  - Pretty confirmation modals (uses window.confirm)
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminFetchHearingState,
  adminForcePrep,
  adminForceProcess,
  adminForceResolve,
  adminRerunPhaseB,
  fetchCommittees,
  fetchHearings,
  type AdminActionResponse,
  type AdminHearingState,
  type AdminResolveResponse,
} from "../api/client";
import type { HearingListItem, HearingStatus } from "../types/api";

type SortColumn = "status" | "hearing_date" | "committee_name" | "title" | "event_id";
type SortDirection = "asc" | "desc";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

const DEFAULT_SORT: SortState = { column: "status", direction: "asc" };

const STATUS_ORDER: HearingStatus[] = [
  "failed",
  "preparing",
  "processing",
  "ready",
  "complete",
  "resolved",
  "detected",
  "postponed",
  "canceled",
];

const STATUS_COLORS: Record<HearingStatus, string> = {
  detected: "#999",
  resolved: "#5b8def",
  preparing: "#7B5EA7",
  ready: "#0039A6",
  processing: "#7B5EA7",
  complete: "#72A375",
  failed: "#c44",
  postponed: "#aa8800",
  canceled: "#888",
};

export function AdminHearings() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HearingStatus | "all">("all");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [openStateFor, setOpenStateFor] = useState<string | null>(null);

  const { data: committees } = useQuery({
    queryKey: ["committees"],
    queryFn: fetchCommittees,
    staleTime: 5 * 60_000, // committee list rarely changes
  });

  // Pull a healthy chunk of hearings. There are ~500 active hearings;
  // the backend caps at 200 per request, so we paginate via offset.
  const { data: page1 } = useQuery({
    queryKey: ["admin-hearings", "page1"],
    queryFn: () => fetchHearings({ limit: 200, offset: 0 }),
    staleTime: 30_000,
    refetchInterval: 15_000, // refresh every 15s so job status changes show up
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

  const allHearings = useMemo(() => {
    const merged = [
      ...(page1?.hearings ?? []),
      ...(page2?.hearings ?? []),
      ...(page3?.hearings ?? []),
    ];
    // Dedup by event_id in case pages overlap
    const seen = new Set<string>();
    return merged.filter((h) => {
      if (seen.has(h.event_id)) return false;
      seen.add(h.event_id);
      return true;
    });
  }, [page1, page2, page3]);

  const filtered = useMemo(() => {
    let list = allHearings;
    if (statusFilter !== "all") {
      list = list.filter((h) => h.status === statusFilter);
    }
    if (committeeFilter !== "all") {
      list = list.filter((h) => h.committee_id === committeeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.committee_name.toLowerCase().includes(q) ||
          h.event_id.toLowerCase().includes(q),
      );
    }
    // Sort by the active column. Status sorts by urgency order
    // (failed/active first); other columns are simple string compare.
    // Date is parsed lex via ISO format so localeCompare DTRT.
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case "status": {
          const sa = STATUS_ORDER.indexOf(a.status);
          const sb = STATUS_ORDER.indexOf(b.status);
          cmp = sa - sb;
          // Tiebreak: most recent first within each status bucket
          if (cmp === 0) cmp = b.hearing_date.localeCompare(a.hearing_date) * dir;
          else cmp = cmp * dir;
          return cmp;
        }
        case "hearing_date":
          cmp = a.hearing_date.localeCompare(b.hearing_date);
          break;
        case "committee_name":
          cmp = a.committee_name.localeCompare(b.committee_name);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "event_id":
          cmp = a.event_id.localeCompare(b.event_id);
          break;
      }
      return cmp * dir;
    });
  }, [allHearings, statusFilter, committeeFilter, search, sort]);

  const handleSort = (column: SortColumn) => {
    setSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      // First click on a new column: ascending for text/date,
      // ascending for status (urgency-first is already the "low" end)
      return { column, direction: "asc" };
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-hearings"] });
    queryClient.invalidateQueries({ queryKey: ["hearings"] });
    queryClient.invalidateQueries({ queryKey: ["admin-hearing-state"] });
  };

  const prepMutation = useMutation({
    mutationFn: ({ eventId, manualUrl }: { eventId: string; manualUrl?: string }) =>
      adminForcePrep(eventId, manualUrl ? { manual_url: manualUrl } : {}),
    onSuccess: (resp: AdminActionResponse) => {
      invalidate();
      const urlNote =
        resp.url_source === "manual"
          ? `\nmanual URL: ${resp.url_used}`
          : "";
      window.alert(
        `Phase A submitted for ${resp.event_id}\n` +
          `status: ${resp.job_status}${urlNote}`,
      );
    },
    onError: (e: Error) => window.alert(`Prep failed: ${e.message}`),
  });
  const resolveMutation = useMutation({
    mutationFn: adminForceResolve,
    onSuccess: (resp: AdminResolveResponse) => {
      invalidate();
      window.alert(
        `Resolved ${resp.event_id}\n` +
          `URL: ${resp.url}\n` +
          `source: ${resp.source_type} (${resp.validation})`,
      );
    },
    onError: (e: Error) => window.alert(`Resolve failed: ${e.message}`),
  });
  const processMutation = useMutation({
    mutationFn: adminForceProcess,
    onSuccess: (resp: AdminActionResponse) => {
      invalidate();
      window.alert(
        `Phase B submitted for ${resp.event_id}\nstatus: ${resp.job_status}`,
      );
    },
    onError: (e: Error) => window.alert(`Process failed: ${e.message}`),
  });
  const rerunMutation = useMutation({
    mutationFn: adminRerunPhaseB,
    onSuccess: (resp: AdminActionResponse) => {
      invalidate();
      window.alert(
        `Re-run submitted for ${resp.event_id}\n` +
          `manifest_cleared: ${resp.manifest_cleared}\n` +
          `phase_a_preserved: ${resp.phase_a_preserved}`,
      );
    },
    onError: (e: Error) => window.alert(`Re-run failed: ${e.message}`),
  });

  const total = allHearings.length;
  const totalPages = page1?.total ?? 0;
  const stillLoading = total < totalPages;

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Inter, sans-serif",
        maxWidth: 1600,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <h1 style={{ margin: 0 }}>Admin · Hearings</h1>
        <span style={{ color: "#666" }}>
          Showing {filtered.length} of {total}
          {stillLoading && totalPages > total && ` (loading ${totalPages}…)`}
        </span>
      </div>

      <p style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
        Force-run any hearing through any stage. Bypasses AutoProcessor
        schedule and pause. Re-run wipes the manifest and the Phase B
        artifacts will be overwritten on next pipeline pass.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 16,
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search by title, committee, or event_id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            width: 320,
            fontSize: 14,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as HearingStatus | "all")
          }
          style={{
            padding: "6px 10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 14,
          }}
        >
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 14,
            maxWidth: 280,
          }}
        >
          <option value="all">All committees</option>
          {(committees ?? [])
            .slice()
            .sort((a, b) => a.committee_name.localeCompare(b.committee_name))
            .map((c) => (
              <option key={c.committee_id} value={c.committee_id}>
                {c.committee_name}
              </option>
            ))}
        </select>
        {(statusFilter !== "all" ||
          committeeFilter !== "all" ||
          search.trim()) && (
          <button
            onClick={() => {
              setStatusFilter("all");
              setCommitteeFilter("all");
              setSearch("");
            }}
            style={{
              padding: "6px 12px",
              border: "1px solid #999",
              borderRadius: 4,
              fontSize: 13,
              background: "white",
              color: "#666",
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <table
        style={{
          width: "100%",
          fontSize: 13,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "2px solid #333",
              textAlign: "left",
            }}
          >
            <SortableTh column="status" sort={sort} onSort={handleSort}>
              Status
            </SortableTh>
            <SortableTh column="hearing_date" sort={sort} onSort={handleSort}>
              Date
            </SortableTh>
            <SortableTh column="committee_name" sort={sort} onSort={handleSort}>
              Committee
            </SortableTh>
            <SortableTh column="title" sort={sort} onSort={handleSort}>
              Title
            </SortableTh>
            <SortableTh column="event_id" sort={sort} onSort={handleSort}>
              event_id
            </SortableTh>
            <th style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((h) => (
            <Row
              key={h.event_id}
              h={h}
              onResolve={(id) => resolveMutation.mutate(id)}
              onPrep={(id) => prepMutation.mutate({ eventId: id })}
              onPrepWithUrl={(id) => {
                const url = window.prompt(
                  `Manual video URL for ${id}.\n\n` +
                    `This bypasses the resolver and persists as a "manual" ` +
                    `resolution. Useful for testing a known-good URL or for ` +
                    `hearings the resolver can't reach.`,
                  "",
                );
                if (url && url.trim()) {
                  prepMutation.mutate({ eventId: id, manualUrl: url.trim() });
                }
              }}
              onProcess={(id) => {
                if (window.confirm(`Submit Phase B for ${id}?`)) {
                  processMutation.mutate(id);
                }
              }}
              onRerun={(id) => {
                if (
                  window.confirm(
                    `Re-run Phase B for ${id}?\n\n` +
                      `Atomic clear: wipes the manifest and the Phase B blobs ` +
                      `(memo, audio brief, audiogram, video, podcast). ` +
                      `Phase A (audio + transcript + speakers) is preserved.`,
                  )
                ) {
                  rerunMutation.mutate(id);
                }
              }}
              onToggleState={() =>
                setOpenStateFor(
                  openStateFor === h.event_id ? null : h.event_id,
                )
              }
              isStateOpen={openStateFor === h.event_id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableTh({
  column,
  sort,
  onSort,
  children,
}: {
  column: SortColumn;
  sort: SortState;
  onSort: (col: SortColumn) => void;
  children: React.ReactNode;
}) {
  const isActive = sort.column === column;
  const arrow = !isActive ? "↕" : sort.direction === "asc" ? "↑" : "↓";
  return (
    <th
      style={{
        padding: "8px 6px",
        cursor: "pointer",
        userSelect: "none",
        color: isActive ? "#0039A6" : "#333",
      }}
      onClick={() => onSort(column)}
    >
      {children}{" "}
      <span
        style={{
          fontSize: 11,
          color: isActive ? "#0039A6" : "#bbb",
          marginLeft: 2,
        }}
      >
        {arrow}
      </span>
    </th>
  );
}

interface RowProps {
  h: HearingListItem;
  onResolve: (id: string) => void;
  onPrep: (id: string) => void;
  onPrepWithUrl: (id: string) => void;
  onProcess: (id: string) => void;
  onRerun: (id: string) => void;
  onToggleState: () => void;
  isStateOpen: boolean;
}

function Row({
  h,
  onResolve,
  onPrep,
  onPrepWithUrl,
  onProcess,
  onRerun,
  onToggleState,
  isStateOpen,
}: RowProps) {
  return (
    <>
      <tr style={{ borderBottom: "1px solid #eee" }}>
        <td style={{ padding: "6px" }}>
          <StatusPill status={h.status} />
        </td>
        <td style={{ padding: "6px", whiteSpace: "nowrap" }}>
          {h.hearing_date.slice(0, 10)}
        </td>
        <td style={{ padding: "6px" }}>{h.committee_name}</td>
        <td
          style={{
            padding: "6px",
            maxWidth: 480,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={h.title}
        >
          {h.title}
        </td>
        <td
          style={{
            padding: "6px",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 11,
            color: "#666",
          }}
        >
          {h.event_id}
        </td>
        <td style={{ padding: "6px", whiteSpace: "nowrap" }}>
          <ActionButtons
            status={h.status}
            onResolve={() => onResolve(h.event_id)}
            onPrep={() => onPrep(h.event_id)}
            onPrepWithUrl={() => onPrepWithUrl(h.event_id)}
            onProcess={() => onProcess(h.event_id)}
            onRerun={() => onRerun(h.event_id)}
            onToggleState={onToggleState}
            isStateOpen={isStateOpen}
          />
        </td>
      </tr>
      {isStateOpen && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: "#f6f7f9" }}>
            <StatePanel eventId={h.event_id} />
          </td>
        </tr>
      )}
    </>
  );
}

function ActionButtons({
  status,
  onResolve,
  onPrep,
  onPrepWithUrl,
  onProcess,
  onRerun,
  onToggleState,
  isStateOpen,
}: {
  status: HearingStatus;
  onResolve: () => void;
  onPrep: () => void;
  onPrepWithUrl: () => void;
  onProcess: () => void;
  onRerun: () => void;
  onToggleState: () => void;
  isStateOpen: boolean;
}) {
  // Show ALL buttons regardless of state — admin should be able to
  // force any action. Visual emphasis (filled vs outlined) signals
  // which action is the "expected" next step for the hearing's
  // current status.
  const expectedAction: "resolve" | "prep" | "process" | "rerun" | "none" =
    status === "detected"
      ? "resolve"
      : status === "resolved"
        ? "prep"
        : status === "ready"
          ? "process"
          : status === "complete" || status === "failed"
            ? "rerun"
            : "none";

  const btn = (
    label: string,
    onClick: () => void,
    isExpected: boolean,
    danger = false,
  ): React.ReactElement => (
    <button
      onClick={onClick}
      style={{
        marginRight: 4,
        padding: "3px 8px",
        fontSize: 12,
        border: `1px solid ${danger ? "#c44" : "#0039A6"}`,
        borderRadius: 3,
        background: isExpected ? (danger ? "#c44" : "#0039A6") : "white",
        color: isExpected ? "white" : danger ? "#c44" : "#0039A6",
        cursor: "pointer",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      {btn("Resolve", onResolve, expectedAction === "resolve")}
      {btn("Prep", onPrep, expectedAction === "prep")}
      {btn("URL…", onPrepWithUrl, false)}
      {btn("Process", onProcess, expectedAction === "process")}
      {btn("Re-run B", onRerun, expectedAction === "rerun", true)}
      <button
        onClick={onToggleState}
        style={{
          marginLeft: 4,
          padding: "3px 8px",
          fontSize: 12,
          border: "1px solid #999",
          borderRadius: 3,
          background: isStateOpen ? "#333" : "white",
          color: isStateOpen ? "white" : "#666",
          cursor: "pointer",
        }}
      >
        {isStateOpen ? "Hide state" : "State"}
      </button>
    </>
  );
}

function StatusPill({ status }: { status: HearingStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 10,
        background: STATUS_COLORS[status] ?? "#999",
        color: "white",
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {status}
    </span>
  );
}

function StatePanel({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useQuery<AdminHearingState>({
    queryKey: ["admin-hearing-state", eventId],
    queryFn: () => adminFetchHearingState(eventId),
    refetchInterval: 5_000, // refresh while a job runs
  });

  if (isLoading) {
    return <div style={{ padding: 12, color: "#666" }}>Loading state…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 12, color: "#c44" }}>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }
  if (!data) {
    return <div style={{ padding: 12, color: "#666" }}>No data.</div>;
  }

  return (
    <div style={{ padding: 12 }}>
      <pre
        style={{
          background: "white",
          padding: 12,
          fontSize: 11,
          fontFamily: "IBM Plex Mono, monospace",
          overflow: "auto",
          maxHeight: 400,
          margin: 0,
          border: "1px solid #ddd",
          borderRadius: 4,
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
