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
 *  - Filter UI for committee / date range (just title-search for now)
 *  - Pretty confirmation modals (uses window.confirm)
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminFetchHearingState,
  adminForcePrep,
  adminForceProcess,
  adminRerunPhaseB,
  fetchHearings,
  type AdminActionResponse,
  type AdminHearingState,
} from "../api/client";
import type { HearingListItem, HearingStatus } from "../types/api";

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
  const [openStateFor, setOpenStateFor] = useState<string | null>(null);

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
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.committee_name.toLowerCase().includes(q) ||
          h.event_id.toLowerCase().includes(q),
      );
    }
    // Sort by status priority (failed/active first), then by date desc
    return [...list].sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      return b.hearing_date.localeCompare(a.hearing_date);
    });
  }, [allHearings, statusFilter, search]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-hearings"] });
    queryClient.invalidateQueries({ queryKey: ["hearings"] });
    queryClient.invalidateQueries({ queryKey: ["admin-hearing-state"] });
  };

  const prepMutation = useMutation({
    mutationFn: adminForcePrep,
    onSuccess: (resp: AdminActionResponse) => {
      invalidate();
      window.alert(
        `Phase A submitted for ${resp.event_id}\nstatus: ${resp.job_status}`,
      );
    },
    onError: (e: Error) => window.alert(`Prep failed: ${e.message}`),
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
            <th style={{ padding: "8px 6px" }}>Status</th>
            <th style={{ padding: "8px 6px" }}>Date</th>
            <th style={{ padding: "8px 6px" }}>Committee</th>
            <th style={{ padding: "8px 6px" }}>Title</th>
            <th style={{ padding: "8px 6px" }}>event_id</th>
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
              onPrep={(id) => prepMutation.mutate(id)}
              onProcess={(id) => {
                if (window.confirm(`Submit Phase B for ${id}?`)) {
                  processMutation.mutate(id);
                }
              }}
              onRerun={(id) => {
                if (
                  window.confirm(
                    `Re-run Phase B for ${id}?\n\n` +
                      `This wipes the hearing manifest. The pipeline will overwrite ` +
                      `existing memo / audio / video artifacts on the next run. ` +
                      `Phase A (transcript) is preserved.`,
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

interface RowProps {
  h: HearingListItem;
  onPrep: (id: string) => void;
  onProcess: (id: string) => void;
  onRerun: (id: string) => void;
  onToggleState: () => void;
  isStateOpen: boolean;
}

function Row({
  h,
  onPrep,
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
            onPrep={() => onPrep(h.event_id)}
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
  onPrep,
  onProcess,
  onRerun,
  onToggleState,
  isStateOpen,
}: {
  status: HearingStatus;
  onPrep: () => void;
  onProcess: () => void;
  onRerun: () => void;
  onToggleState: () => void;
  isStateOpen: boolean;
}) {
  // Show ALL buttons regardless of state — admin should be able to
  // force any action. Visual emphasis (filled vs outlined) signals
  // which action is the "expected" next step for the hearing's
  // current status.
  const expectedAction: "prep" | "process" | "rerun" | "none" =
    status === "resolved"
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
      {btn("Prep", onPrep, expectedAction === "prep")}
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
