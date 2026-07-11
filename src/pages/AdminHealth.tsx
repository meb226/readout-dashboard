/**
 * ML-649: Video-acquisition resolution-health report.
 *
 * Renders GET /api/admin/resolution-health — the sellable SLA number
 * ("we acquire X% of broadcast hearings") plus everything needed to act
 * on the gap: the true-miss list (unresolved past the upload window),
 * the in-flight set (aired recently, video may still post — not graded),
 * per-committee rates, and the audited no-broadcast exclusions.
 *
 * Operator tool in the AdminHearings visual style: flat, info-dense,
 * Inter, no gradient chrome.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPills } from "../components/AdminPills";
import {
  adminFetchResolutionHealth,
  type HealthCommitteeRow,
  type HealthMissItem,
} from "../api/client";

const NAVY = "#0039A6";
const GREEN = "#065F46";
const RED = "#991B1B";

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "0.72rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6B7280",
  borderBottom: "2px solid #E5E7EB",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "0.85rem",
  borderBottom: "1px solid #F3F4F6",
  verticalAlign: "top",
};

const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function rateColor(rate: number): string {
  if (rate >= 0.97) return GREEN;
  if (rate >= 0.9) return "#92400E";
  return RED;
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{
      border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 18px",
      minWidth: 150, background: "#fff",
    }}>
      <div style={{
        fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.04em", color: "#6B7280", marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: color ?? "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ReasonChips({ reasons }: { reasons: Record<string, number> }) {
  const entries = Object.entries(reasons);
  if (entries.length === 0) return <span style={{ color: "#6B7280", fontSize: "0.85rem" }}>none</span>;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {entries.map(([reason, count]) => (
        <span key={reason} style={{
          background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 999,
          padding: "2px 10px", fontSize: "0.75rem", color: "#374151",
        }}>
          {reason.replace(/_/g, " ")} · {count}
        </span>
      ))}
    </div>
  );
}

function MissTable({ items, emptyLabel }: { items: HealthMissItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p style={{ color: "#6B7280", fontSize: "0.85rem", margin: "8px 0" }}>{emptyLabel}</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Committee</th>
            <th style={{ ...th, textAlign: "right" }}>Age</th>
            <th style={th}>Reason</th>
            <th style={th}>Title</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.event_id}>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{m.date ?? "?"}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{m.committee_id}</td>
              <td style={num}>{m.age_days}d</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{m.reason.replace(/_/g, " ")}</td>
              <td style={{ ...td, wordBreak: "break-word" }}>{m.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminHealth() {
  const [showInFlight, setShowInFlight] = useState(false);
  const [showNoBroadcast, setShowNoBroadcast] = useState(false);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-resolution-health"],
    queryFn: adminFetchResolutionHealth,
    staleTime: 60_000,
  });

  return (
    <>
      <AdminPills current="readout" />
      <div style={{
        padding: 32, fontFamily: "Inter, system-ui, sans-serif",
        maxWidth: 1200, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>
            Acquisition Health
          </h1>
          <span style={{ color: "#6B7280", fontSize: "0.85rem" }}>
            of the hearings that should have a recording, what % did we acquire
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              marginLeft: "auto", padding: "6px 14px", borderRadius: 8,
              border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer",
              fontSize: "0.8rem", color: "#374151",
            }}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {isPending && <p style={{ color: "#6B7280", marginTop: 24 }}>Loading health report…</p>}
        {error && (
          <p style={{ color: RED, marginTop: 24 }}>
            Failed to load: {(error as Error).message}
          </p>
        )}

        {data && (
          <>
            {/* Headline stats */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
              <StatCard
                label="SLA rate"
                value={pct(data.overall.resolution_rate)}
                sub={`resolved ${data.overall.resolved} of ${data.overall.resolved + data.overall.missed} graded`}
                color={rateColor(data.overall.resolution_rate)}
              />
              <StatCard
                label="True misses"
                value={String(data.overall.missed)}
                sub={`unresolved past ${data.upload_window_days}d — actionable`}
                color={data.overall.missed > 0 ? RED : GREEN}
              />
              <StatCard
                label="In-flight"
                value={String(data.overall.in_flight)}
                sub="aired recently, video may still post — not graded"
              />
              <StatCard
                label="No broadcast"
                value={String(data.overall.no_broadcast)}
                sub="canceled / closed / phantom — excluded"
              />
              <StatCard
                label="Future"
                value={String(data.overall.future)}
                sub={`of ${data.overall.total} total hearings`}
              />
            </div>

            {/* True misses — the actionable list */}
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "26px 0 4px" }}>
              True misses ({data.misses.length})
            </h2>
            <div style={{ margin: "6px 0 10px" }}>
              <ReasonChips reasons={data.unresolved_by_reason} />
            </div>
            <MissTable items={data.misses} emptyLabel="No true misses 🎉" />

            {/* Per-committee table */}
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "26px 0 8px" }}>
              By committee
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={th}>Committee</th>
                    <th style={{ ...th, textAlign: "right" }}>Rate</th>
                    <th style={{ ...th, textAlign: "right" }}>Resolved</th>
                    <th style={{ ...th, textAlign: "right" }}>Missed</th>
                    <th style={{ ...th, textAlign: "right" }}>In-flight</th>
                    <th style={{ ...th, textAlign: "right" }}>No broadcast</th>
                    <th style={{ ...th, textAlign: "right" }}>Oldest miss</th>
                  </tr>
                </thead>
                <tbody>
                  {data.committees.map((c: HealthCommitteeRow) => (
                    <tr key={c.committee_id}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{c.committee_id}</td>
                      <td style={{ ...num, fontWeight: 600, color: rateColor(c.resolution_rate) }}>
                        {pct(c.resolution_rate)}
                      </td>
                      <td style={num}>{c.resolved}</td>
                      <td style={{ ...num, color: c.missed > 0 ? RED : "#111827" }}>{c.missed}</td>
                      <td style={num}>{c.in_flight}</td>
                      <td style={num}>{c.no_broadcast}</td>
                      <td style={num}>{c.oldest_unresolved_days > 0 ? `${c.oldest_unresolved_days}d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* In-flight (collapsed by default — informational, not actionable) */}
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "26px 0 8px" }}>
              <button
                onClick={() => setShowInFlight((v) => !v)}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  font: "inherit", color: NAVY,
                }}
              >
                {showInFlight ? "▾" : "▸"} In-flight ({data.in_flight.length})
              </button>
            </h2>
            {showInFlight && (
              <MissTable items={data.in_flight} emptyLabel="Nothing in-flight." />
            )}

            {/* No-broadcast audit (collapsed) */}
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "26px 0 8px" }}>
              <button
                onClick={() => setShowNoBroadcast((v) => !v)}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  font: "inherit", color: NAVY,
                }}
              >
                {showNoBroadcast ? "▾" : "▸"} No-broadcast exclusions ({data.no_broadcast.length})
              </button>
            </h2>
            <div style={{ margin: "6px 0 10px" }}>
              <ReasonChips reasons={data.no_broadcast_by_reason} />
            </div>
            {showNoBroadcast && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Committee</th>
                      <th style={th}>Reason</th>
                      <th style={th}>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.no_broadcast.map((n) => (
                      <tr key={n.event_id}>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{n.date ?? "?"}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{n.committee_id}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{n.reason.replace(/_/g, " ")}</td>
                        <td style={{ ...td, wordBreak: "break-word" }}>{n.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ color: "#9CA3AF", fontSize: "0.75rem", marginTop: 24 }}>
              Generated {data.generated_at} · upload window {data.upload_window_days}d ·
              in-flight hearings are excluded from the SLA denominator (committees post
              recordings 1–2 weeks late).
            </p>
          </>
        )}
      </div>
    </>
  );
}
