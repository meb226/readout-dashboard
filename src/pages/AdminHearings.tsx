/**
 * ML-535: Admin force-run view for any hearing in any state.
 *
 * Lists every hearing in a flat info-dense table. Per-row buttons fire
 * the corresponding admin endpoint. Designed for "find this hearing
 * and force it through stage X right now" — operator + debugging tool,
 * not customer-facing UI.
 *
 * Confirmation style: inline. Destructive actions flip the row (or
 * the bulk toolbar) into a Confirm/Cancel prompt instead of opening
 * a separate dialog. Cheaper context-switch when running 5 hearings
 * in a row during ops work.
 *
 * Bulk ops: checkbox per row + select-all-visible in the header. When
 * any rows are selected, a toolbar appears with bulk Process and
 * bulk Re-run B buttons. Bulk fires N parallel mutations and surfaces
 * a single summary alert with success/fail counts.
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
type RowConfirmAction = "process" | "rerun" | "url";
type BulkAction = "process" | "rerun";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

interface RowConfirmState {
  eventId: string;
  action: RowConfirmAction;
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
  const [confirming, setConfirming] = useState<RowConfirmState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState<BulkAction | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data: committees } = useQuery({
    queryKey: ["committees"],
    queryFn: fetchCommittees,
    staleTime: 5 * 60_000,
  });

  // Pull a healthy chunk of hearings (~600 rows in 3 pages of 200)
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

  const allHearings = useMemo(() => {
    const merged = [
      ...(page1?.hearings ?? []),
      ...(page2?.hearings ?? []),
      ...(page3?.hearings ?? []),
    ];
    const seen = new Set<string>();
    return merged.filter((h) => {
      if (seen.has(h.event_id)) return false;
      seen.add(h.event_id);
      return true;
    });
  }, [page1, page2, page3]);

  const filtered = useMemo(() => {
    let list = allHearings;
    if (statusFilter !== "all") list = list.filter((h) => h.status === statusFilter);
    if (committeeFilter !== "all")
      list = list.filter((h) => h.committee_id === committeeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.committee_name.toLowerCase().includes(q) ||
          h.event_id.toLowerCase().includes(q),
      );
    }
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case "status": {
          const sa = STATUS_ORDER.indexOf(a.status);
          const sb = STATUS_ORDER.indexOf(b.status);
          cmp = sa - sb;
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

  const handleSort = (column: SortColumn) =>
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-hearings"] });
    queryClient.invalidateQueries({ queryKey: ["hearings"] });
    queryClient.invalidateQueries({ queryKey: ["admin-hearing-state"] });
  };

  // ---- Per-row mutations ----
  const prepMutation = useMutation({
    mutationFn: ({ eventId, manualUrl }: { eventId: string; manualUrl?: string }) =>
      adminForcePrep(eventId, manualUrl ? { manual_url: manualUrl } : {}),
    onSuccess: (resp: AdminActionResponse) => {
      invalidate();
      const urlNote =
        resp.url_source === "manual" ? `\nmanual URL: ${resp.url_used}` : "";
      window.alert(
        `Transcribe queued for ${resp.event_id}\nstatus: ${resp.job_status}${urlNote}`,
      );
    },
    onError: (e: Error) => window.alert(`Transcribe failed: ${e.message}`),
  });
  const resolveMutation = useMutation({
    mutationFn: adminForceResolve,
    onSuccess: (resp: AdminResolveResponse) => {
      invalidate();
      window.alert(
        `Found video for ${resp.event_id}\nURL: ${resp.url}\nsource: ${resp.source_type} (${resp.validation})`,
      );
    },
    onError: (e: Error) => window.alert(`Find video failed: ${e.message}`),
  });
  const processMutation = useMutation({
    mutationFn: adminForceProcess,
    onSuccess: (resp: AdminActionResponse) => {
      invalidate();
      window.alert(
        `Make brief queued for ${resp.event_id}\nstatus: ${resp.job_status}`,
      );
    },
    onError: (e: Error) => window.alert(`Make brief failed: ${e.message}`),
  });
  const rerunMutation = useMutation({
    mutationFn: adminRerunPhaseB,
    onSuccess: (resp: AdminActionResponse) => {
      invalidate();
      window.alert(
        `Remake queued for ${resp.event_id}\nartifacts_deleted: ${resp.artifacts_deleted ?? "?"}\ntranscript_preserved: ${resp.phase_a_preserved}`,
      );
    },
    onError: (e: Error) => window.alert(`Remake failed: ${e.message}`),
  });

  // ---- Bulk runner ----
  const runBulk = async (action: BulkAction) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkRunning(true);
    const fn = action === "process" ? adminForceProcess : adminRerunPhaseB;
    const results = await Promise.allSettled(ids.map((id) => fn(id)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fails = results
      .map((r, i) =>
        r.status === "rejected"
          ? `${ids[i]}: ${(r.reason as Error)?.message ?? "unknown"}`
          : null,
      )
      .filter(Boolean) as string[];
    setBulkRunning(false);
    setBulkConfirming(null);
    setSelected(new Set());
    invalidate();
    window.alert(
      `${action === "process" ? "Phase B" : "Re-run"} bulk submit\n` +
        `succeeded: ${ok} / ${ids.length}` +
        (fails.length
          ? `\n\nfailures:\n${fails.slice(0, 8).join("\n")}${fails.length > 8 ? `\n…and ${fails.length - 8} more` : ""}`
          : ""),
    );
  };

  // ---- Selection helpers ----
  const visibleIds = useMemo(() => filtered.map((h) => h.event_id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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
        Force any hearing through any stage. Hover a button for details.
        Order of operations: <strong>Find video</strong> →{" "}
        <strong>Transcribe</strong> → <strong>Make brief</strong>.{" "}
        <strong>Remake</strong> wipes the brief outputs and regenerates
        them (transcript preserved).
      </p>

      <FilterBar
        search={search}
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        committeeFilter={committeeFilter}
        onCommitteeFilter={setCommitteeFilter}
        committees={committees ?? []}
        onClear={() => {
          setStatusFilter("all");
          setCommitteeFilter("all");
          setSearch("");
        }}
      />

      <BulkToolbar
        selected={selected}
        bulkConfirming={bulkConfirming}
        bulkRunning={bulkRunning}
        onClear={() => setSelected(new Set())}
        onBulkAction={(a) => setBulkConfirming(a)}
        onBulkConfirm={(a) => runBulk(a)}
        onBulkCancel={() => setBulkConfirming(null)}
      />

      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
            <th style={{ padding: "8px 6px", width: 28 }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                title={
                  allVisibleSelected
                    ? "Deselect all visible"
                    : "Select all visible"
                }
              />
            </th>
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
            <th style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((h) => (
            <Row
              key={h.event_id}
              h={h}
              isSelected={selected.has(h.event_id)}
              onToggleSelect={() => toggleOne(h.event_id)}
              confirmingAction={
                confirming?.eventId === h.event_id ? confirming.action : null
              }
              onRequestConfirm={(action) =>
                setConfirming({ eventId: h.event_id, action })
              }
              onCancelConfirm={() => setConfirming(null)}
              onResolve={() => resolveMutation.mutate(h.event_id)}
              onPrep={() => prepMutation.mutate({ eventId: h.event_id })}
              onPrepWithUrl={(url) =>
                prepMutation.mutate({ eventId: h.event_id, manualUrl: url })
              }
              onProcess={() => {
                processMutation.mutate(h.event_id);
                setConfirming(null);
              }}
              onRerun={() => {
                rerunMutation.mutate(h.event_id);
                setConfirming(null);
              }}
              onToggleState={() =>
                setOpenStateFor(openStateFor === h.event_id ? null : h.event_id)
              }
              isStateOpen={openStateFor === h.event_id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------

function FilterBar({
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  committeeFilter,
  onCommitteeFilter,
  committees,
  onClear,
}: {
  search: string;
  onSearch: (v: string) => void;
  statusFilter: HearingStatus | "all";
  onStatusFilter: (v: HearingStatus | "all") => void;
  committeeFilter: string;
  onCommitteeFilter: (v: string) => void;
  committees: { committee_id: string; name: string }[];
  onClear: () => void;
}) {
  const hasActive =
    statusFilter !== "all" || committeeFilter !== "all" || search.trim() !== "";
  return (
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
        onChange={(e) => onSearch(e.target.value)}
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
        onChange={(e) => onStatusFilter(e.target.value as HearingStatus | "all")}
        style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
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
        onChange={(e) => onCommitteeFilter(e.target.value)}
        style={{
          padding: "6px 10px",
          border: "1px solid #ccc",
          borderRadius: 4,
          fontSize: 14,
          maxWidth: 280,
        }}
      >
        <option value="all">All committees</option>
        {committees
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => (
            <option key={c.committee_id} value={c.committee_id}>
              {c.name}
            </option>
          ))}
      </select>
      {hasActive && (
        <button
          onClick={onClear}
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
  );
}

// ---------------------------------------------------------------------
// Bulk-action toolbar
// ---------------------------------------------------------------------

function BulkToolbar({
  selected,
  bulkConfirming,
  bulkRunning,
  onClear,
  onBulkAction,
  onBulkConfirm,
  onBulkCancel,
}: {
  selected: Set<string>;
  bulkConfirming: BulkAction | null;
  bulkRunning: boolean;
  onClear: () => void;
  onBulkAction: (a: BulkAction) => void;
  onBulkConfirm: (a: BulkAction) => void;
  onBulkCancel: () => void;
}) {
  if (selected.size === 0) return null;
  const danger = bulkConfirming === "rerun";
  if (bulkConfirming) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 10,
          background: danger ? "#fdf3f3" : "#f0f7ff",
          border: `1px solid ${danger ? "#c44" : "#5b8def"}`,
          borderRadius: 4,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <span style={{ flex: 1, color: "#333" }}>
          {bulkConfirming === "process"
            ? `Make briefs for ${selected.size} hearing${selected.size === 1 ? "" : "s"}?`
            : `Wipe and remake briefs for ${selected.size} hearing${selected.size === 1 ? "" : "s"}? (transcripts preserved)`}
        </span>
        <SmallButton
          label={bulkRunning ? "Running…" : "Confirm"}
          onClick={() => !bulkRunning && onBulkConfirm(bulkConfirming)}
          danger={danger}
          disabled={bulkRunning}
        />
        <SmallButton label="Cancel" onClick={onBulkCancel} ghost disabled={bulkRunning} />
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: 10,
        background: "#fafafa",
        border: "1px solid #ddd",
        borderRadius: 4,
        marginBottom: 12,
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1, color: "#333", fontWeight: 500 }}>
        {selected.size} selected
      </span>
      <SmallButton
        label="Make briefs for selected"
        onClick={() => onBulkAction("process")}
      />
      <SmallButton
        label="Remake selected"
        onClick={() => onBulkAction("rerun")}
        danger
      />
      <SmallButton label="Clear" onClick={onClear} ghost />
    </div>
  );
}

// ---------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------

interface RowProps {
  h: HearingListItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  confirmingAction: RowConfirmAction | null;
  onRequestConfirm: (action: RowConfirmAction) => void;
  onCancelConfirm: () => void;
  onResolve: () => void;
  onPrep: () => void;
  onPrepWithUrl: (url: string) => void;
  onProcess: () => void;
  onRerun: () => void;
  onToggleState: () => void;
  isStateOpen: boolean;
}

function Row({
  h,
  isSelected,
  onToggleSelect,
  confirmingAction,
  onRequestConfirm,
  onCancelConfirm,
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
      <tr
        style={{
          borderBottom: "1px solid #eee",
          background: isSelected ? "#f0f7ff" : "transparent",
        }}
      >
        <td style={{ padding: "6px" }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select ${h.event_id}`}
          />
        </td>
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
          {confirmingAction ? (
            <InlineConfirm
              action={confirmingAction}
              onProcess={onProcess}
              onRerun={onRerun}
              onPrepWithUrl={onPrepWithUrl}
              onCancel={onCancelConfirm}
            />
          ) : (
            <ActionButtons
              status={h.status}
              onResolve={onResolve}
              onPrep={onPrep}
              onPrepWithUrl={() => onRequestConfirm("url")}
              onProcess={() => onRequestConfirm("process")}
              onRerun={() => onRequestConfirm("rerun")}
              onToggleState={onToggleState}
              isStateOpen={isStateOpen}
            />
          )}
        </td>
      </tr>
      {isStateOpen && (
        <tr>
          <td colSpan={7} style={{ padding: 0, background: "#f6f7f9" }}>
            <StatePanel eventId={h.event_id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Inline confirmation row (replaces window.confirm/prompt)
// ---------------------------------------------------------------------

function InlineConfirm({
  action,
  onProcess,
  onRerun,
  onPrepWithUrl,
  onCancel,
}: {
  action: RowConfirmAction;
  onProcess: () => void;
  onRerun: () => void;
  onPrepWithUrl: (url: string) => void;
  onCancel: () => void;
}) {
  const [urlValue, setUrlValue] = useState("");
  const danger = action === "rerun";
  const bg = danger ? "#fdf3f3" : "#f0f7ff";
  const border = danger ? "#c44" : "#5b8def";

  if (action === "url") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 6px",
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 3,
        }}
      >
        <input
          type="text"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="https://..."
          autoFocus
          style={{
            width: 240,
            padding: "3px 6px",
            border: "1px solid #ccc",
            borderRadius: 3,
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && urlValue.trim()) onPrepWithUrl(urlValue.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        <SmallButton
          label="Submit"
          onClick={() => urlValue.trim() && onPrepWithUrl(urlValue.trim())}
        />
        <SmallButton label="Cancel" onClick={onCancel} ghost />
      </div>
    );
  }

  const prompt =
    action === "process"
      ? "Make brief?"
      : "Wipe and remake the brief? (transcript preserved)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 3,
        fontSize: 12,
      }}
    >
      <span style={{ color: "#333" }}>{prompt}</span>
      <SmallButton
        label="Confirm"
        onClick={action === "process" ? onProcess : onRerun}
        danger={danger}
      />
      <SmallButton label="Cancel" onClick={onCancel} ghost />
    </div>
  );
}

// ---------------------------------------------------------------------
// Action buttons (idle row state)
// ---------------------------------------------------------------------

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
    tooltip: string,
    danger = false,
  ) => (
    <button
      onClick={onClick}
      title={tooltip}
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
      {btn(
        "Find video",
        onResolve,
        expectedAction === "resolve",
        "Look up the video URL on Congress.gov / YouTube / Senate ISVP. Use this on hearings where we know the meeting exists but haven't found the recording yet.",
      )}
      {btn(
        "Transcribe",
        onPrep,
        expectedAction === "prep",
        "Download the audio, run it through Deepgram, identify speakers. Needs a video URL already in place.",
      )}
      {btn(
        "Make brief",
        onProcess,
        expectedAction === "process",
        "Generate the memo, audio brief, podcast, and audiogram. Needs the transcript done.",
      )}
      {btn(
        "Remake",
        onRerun,
        expectedAction === "rerun",
        "Wipe the brief outputs (memo, audio, video, podcast) and regenerate. The transcript is preserved.",
        true,
      )}
      <span
        style={{
          display: "inline-block",
          width: 1,
          height: 16,
          background: "#ddd",
          margin: "0 6px 0 2px",
          verticalAlign: "middle",
        }}
        aria-hidden
      />
      {btn(
        "Use my URL…",
        onPrepWithUrl,
        false,
        "Manual override. Paste a video URL by hand and run transcription against it. Skips Find video entirely. Useful when the auto-finder can't reach the video, or you want to test a known-good URL.",
      )}
      <button
        onClick={onToggleState}
        title="Show the raw state JSON for debugging: hearing row, video resolution, job records, manifest stages."
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
        {isStateOpen ? "Hide" : "Inspect"}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------

function SmallButton({
  label,
  onClick,
  danger,
  ghost,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  ghost?: boolean;
  disabled?: boolean;
}) {
  const color = danger ? "#c44" : "#0039A6";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "3px 8px",
        fontSize: 12,
        border: `1px solid ${ghost ? "#999" : color}`,
        borderRadius: 3,
        background: ghost ? "white" : color,
        color: ghost ? "#666" : "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {label}
    </button>
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
    refetchInterval: 5_000,
  });

  if (isLoading)
    return <div style={{ padding: 12, color: "#666" }}>Loading state…</div>;
  if (error)
    return (
      <div style={{ padding: 12, color: "#c44" }}>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  if (!data) return <div style={{ padding: 12, color: "#666" }}>No data.</div>;

  return (
    <div style={{ padding: 12, maxWidth: "100%", boxSizing: "border-box" }}>
      <pre
        style={{
          background: "white",
          padding: 12,
          fontSize: 11,
          fontFamily: "IBM Plex Mono, monospace",
          // pre-wrap keeps the JSON's intentional line breaks and indentation,
          // and break-word lets long URLs / hearing_ids wrap mid-token instead
          // of blowing out the table width.
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 400,
          overflowY: "auto",
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
