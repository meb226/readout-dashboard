/**
 * Manual pipeline controls — wake the poller / backfill on demand.
 *
 * The poller only runs weekday business hours (nothing polls on
 * weekends) and the backfill resolver sweeps every ~3h; these buttons
 * run a cycle right now when the operator suspects something's been
 * missed. Pause does NOT stop these — pause only halts automatic
 * Phase A/B compute. Rendered on /admin/hearings and /admin/studio.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminBackfillNow,
  adminPipelineStatus,
  adminPollNow,
} from "../api/client";

export function PipelineControls() {
  const queryClient = useQueryClient();
  const { data: pipeline } = useQuery({
    queryKey: ["pipeline-status"],
    queryFn: adminPipelineStatus,
    refetchInterval: 15_000,
  });

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";

  const pollNow = useMutation({
    mutationFn: adminPollNow,
    onSuccess: (r) => {
      window.alert(r.note);
      queryClient.invalidateQueries({ queryKey: ["pipeline-status"] });
    },
    onError: (e: Error) => window.alert(`Poll trigger failed: ${e.message}`),
  });
  const backfillNow = useMutation({
    mutationFn: adminBackfillNow,
    onSuccess: (r) => {
      window.alert(r.note);
      queryClient.invalidateQueries({ queryKey: ["pipeline-status"] });
    },
    onError: (e: Error) => window.alert(`Backfill trigger failed: ${e.message}`),
  });

  const btn: React.CSSProperties = {
    padding: "4px 10px", fontSize: 12, fontWeight: 600,
    border: "1px solid #c9d2de", borderRadius: 6, background: "#fff",
    color: "#223", cursor: "pointer",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "8px 12px", margin: "4px 0 12px", background: "#f7f9fc",
      border: "1px solid #e3e8ef", borderRadius: 8, fontSize: 12, color: "#556",
    }}>
      <button style={btn} onClick={() => pollNow.mutate()}
        title="Run one Congress.gov poll cycle now (detects new hearings + resolves their videos). Bypasses the weekday-business-hours schedule once.">
        Poll Congress.gov now
      </button>
      <span>last poll: {fmt(pipeline?.poller?.last_poll_at)}{pipeline?.poller?.last_poll_error ? " ⚠" : ""}</span>
      <span style={{ color: "#c9d2de" }}>|</span>
      <button style={btn} onClick={() => backfillNow.mutate()}
        title="Re-run the video resolver against unresolved hearings now (late-posted videos, prior failures). Normally sweeps every ~3 hours.">
        Re-check missing videos
      </button>
      <span>last sweep: {fmt(pipeline?.backfill?.last_run_at)}{pipeline?.backfill?.last_run_error ? " ⚠" : ""}</span>
      {pipeline?.auto_processor_paused && (
        <span style={{ color: "#aa8800", fontWeight: 600 }}>
          auto-processor paused (detection/resolution still run; no automatic briefs)
        </span>
      )}
    </div>
  );
}
