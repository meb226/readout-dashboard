/**
 * Client profile manager — /settings/clients (ML-63).
 *
 * A "client profile" is a saved Senate LDA (Lobbying Disclosure Act)
 * search: the lobbying firm or client organization a user represents,
 * plus which of its lobbying issue areas ("clusters") should drive the
 * client-lens annotations on hearing memos.
 *
 * Flow: type the LDA name → pick registrant vs client search → Search
 * (slow, live LDA crawl) → toggle which issue clusters matter → name
 * the profile → Save. Existing profiles can be expanded to re-toggle
 * clusters, refreshed against LDA, or deleted (inline confirm — we
 * never use window.confirm in this codebase).
 *
 * Mirrors the structure and styling of CommitteeSettings.tsx.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import {
  useClients,
  useLdaSearch,
  useCreateClient,
  useUpdateClient,
  useRefreshClient,
  useDeleteClient,
} from "../hooks/useClients";
import type { ClientProfile, IssueCluster, LdaSearchResponse } from "../types/api";

type SearchType = "registrant" | "client";

/* ── Small helpers ─────────────────────────────────────────────── */

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "never";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The backend's apiFetch error reads "API 422: {...}". We surface the
 *  no-activity case with friendlier copy than the raw JSON body. */
function isNoActivityError(err: Error): boolean {
  return err.message.startsWith("API 422");
}

/* ── Cluster chip/card ─────────────────────────────────────────── */

function ClusterCard({
  cluster,
  selected,
  onToggle,
}: {
  cluster: IssueCluster;
  selected: boolean;
  onToggle: () => void;
}) {
  // Each card manages its own "read more" state — expanding one card
  // to read description snippets shouldn't disturb its neighbors.
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border px-3 py-2.5 transition-all"
      style={{
        borderColor: selected ? "var(--color-navy)" : "var(--color-border)",
        background: selected ? "var(--color-navy-light)" : "var(--color-surface)",
      }}
    >
      {/* Whole header row toggles selection — big click target. */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start justify-between gap-2"
      >
        <div className="min-w-0">
          <div className="font-heading font-semibold text-sm text-text">
            {cluster.issue_name}
          </div>
          <div className="text-xs text-text-faint mt-0.5">
            {cluster.filing_count} filing{cluster.filing_count === 1 ? "" : "s"}
          </div>
        </div>
        {/* Selection indicator — filled navy check when active. */}
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={
            selected
              ? { background: "var(--color-navy)", color: "white" }
              : {
                  background: "transparent",
                  border: "1.5px solid var(--color-border)",
                  color: "transparent",
                }
          }
          aria-hidden
        >
          ✓
        </span>
      </button>

      {/* Up to 3 bills as small mono tags. */}
      {cluster.bills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {cluster.bills.slice(0, 3).map((bill) => (
            <span
              key={bill}
              className="font-mono text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(0,0,0,0.05)",
                color: "var(--color-text-muted)",
              }}
            >
              {bill}
            </span>
          ))}
          {cluster.bills.length > 3 && (
            <span className="text-[10px] text-text-faint self-center">
              +{cluster.bills.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Expandable description snippets from the actual LDA filings. */}
      {cluster.descriptions.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[11px] font-heading font-semibold text-navy hover:underline"
          >
            {expanded ? "Hide details" : "Details"}
          </button>
          {expanded && (
            <ul className="mt-1.5 space-y-1.5">
              {cluster.descriptions.slice(0, 3).map((desc, i) => (
                <li
                  key={i}
                  className="text-[11px] leading-snug text-text-muted pl-2"
                  style={{ borderLeft: "2px solid var(--color-border)" }}
                >
                  {desc}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** Grid of cluster cards with a shared selection set. Used by both the
 *  add-client flow and the edit-existing-profile expansion. */
function ClusterPicker({
  clusters,
  selected,
  onToggle,
}: {
  clusters: IssueCluster[];
  selected: Set<string>;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {clusters.map((cluster) => (
        <ClusterCard
          key={cluster.issue_code}
          cluster={cluster}
          selected={selected.has(cluster.issue_code)}
          onToggle={() => onToggle(cluster.issue_code)}
        />
      ))}
    </div>
  );
}

/* ── Existing profile row ──────────────────────────────────────── */

function ProfileRow({ profile }: { profile: ClientProfile }) {
  const updateClient = useUpdateClient();
  const refreshClient = useRefreshClient();
  const deleteClient = useDeleteClient();

  const [expanded, setExpanded] = useState(false);
  // Inline delete confirm — the button flips to Confirm/Cancel in
  // place (same pattern as the ML-535 admin table; no window.confirm).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = new Set(profile.selected_issue_codes);

  // Toggling a cluster PATCHes immediately — there's no separate Save
  // step for edits, matching how committee subscriptions toggle live.
  async function handleClusterToggle(code: string) {
    const next = new Set(selectedSet);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setError(null);
    try {
      await updateClient.mutateAsync({
        id: profile.id,
        selected_issue_codes: Array.from(next),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRefresh() {
    setError(null);
    try {
      await refreshClient.mutateAsync(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteClient.mutateAsync(profile.id);
      // Row disappears via the invalidated ["clients"] query.
    } catch (err) {
      setConfirmingDelete(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const busy =
    updateClient.isPending || refreshClient.isPending || deleteClient.isPending;

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Clicking the name/info block expands the cluster editor. */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="min-w-0 text-left flex-1"
        >
          <div className="font-heading font-semibold text-sm text-text truncate">
            {profile.display_name}
            <span
              className="ml-2 inline-block transition-transform text-text-faint text-[10px]"
              style={{ transform: expanded ? "rotate(90deg)" : "none" }}
              aria-hidden
            >
              ▶
            </span>
          </div>
          <div className="text-xs text-text-faint mt-0.5">
            {profile.registrant_name}
            {" · "}
            {profile.selected_issue_codes.length} of {profile.clusters.length}{" "}
            issue area{profile.clusters.length === 1 ? "" : "s"} active
            {" · "}
            refreshed {formatDate(profile.last_refreshed)}
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg text-xs font-heading font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--color-red)" }}
              >
                {deleteClient.isPending ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-heading font-semibold border border-border text-text-muted hover:text-text"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleRefresh}
                title="Re-run the LDA search and refresh this profile's issue areas (takes ~5-20s)"
                className="px-3 py-1.5 rounded-lg text-xs font-heading font-semibold border disabled:opacity-50"
                style={{
                  borderColor: "var(--color-navy)",
                  color: "var(--color-navy)",
                  background: "var(--color-surface)",
                }}
              >
                {refreshClient.isPending ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-heading font-semibold border border-border text-text-muted hover:text-red hover:border-red transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red">
          {error}
        </div>
      )}

      {expanded && (
        <div className="mt-3">
          <div className="text-[11px] font-heading font-semibold uppercase tracking-wider text-text-faint mb-2">
            Active issue areas
            {updateClient.isPending && (
              <span className="ml-2 normal-case font-normal tracking-normal">
                saving…
              </span>
            )}
          </div>
          <ClusterPicker
            clusters={profile.clusters}
            selected={selectedSet}
            onToggle={handleClusterToggle}
          />
        </div>
      )}
    </li>
  );
}

/* ── Add-client flow ───────────────────────────────────────────── */

function AddClientFlow() {
  const search = useLdaSearch();
  const create = useCreateClient();

  const [name, setName] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("registrant");
  // Populated after a successful search; null = still on step 1.
  const [results, setResults] = useState<LdaSearchResponse | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  async function handleSearch() {
    const trimmed = name.trim();
    if (!trimmed || search.isPending) return;
    setInlineError(null);
    setSavedName(null);
    setResults(null);
    try {
      const res = await search.mutateAsync({
        registrant_name: trimmed,
        search_type: searchType,
      });
      if (res.clusters.length === 0) {
        setInlineError(
          `No LDA lobbying activity found for "${trimmed}". Check the spelling against the Senate LDA database, or try the other search type.`,
        );
        return;
      }
      setResults(res);
      setDisplayName(trimmed); // default display name = the searched name
      // Default: every cluster active — users prune, not build up.
      setSelectedCodes(new Set(res.clusters.map((c) => c.issue_code)));
    } catch (err) {
      setInlineError(
        err instanceof Error
          ? isNoActivityError(err)
            ? `No LDA lobbying activity found for "${trimmed}". Check the spelling against the Senate LDA database, or try the other search type.`
            : `Search failed: ${err.message}`
          : String(err),
      );
    }
  }

  function toggleCode(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!results || create.isPending) return;
    setInlineError(null);
    try {
      const profile = await create.mutateAsync({
        display_name: displayName.trim() || results.registrant_name,
        registrant_name: results.registrant_name,
        search_type: results.search_type,
        selected_issue_codes: Array.from(selectedCodes),
      });
      // Reset the flow back to step 1 with a success note.
      setSavedName(profile.display_name);
      setResults(null);
      setName("");
    } catch (err) {
      setInlineError(
        err instanceof Error
          ? isNoActivityError(err)
            ? "No LDA activity found for that name — the profile wasn't saved."
            : `Save failed: ${err.message}`
          : String(err),
      );
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
        Add a client
      </h3>

      {/* Step 1 — name + search-type toggle + Search */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="Name as it appears in LDA filings…"
          className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-border text-sm focus:outline-none"
          style={{ background: "var(--color-bg)" }}
          disabled={search.isPending}
        />

        {/* Two-option search-type toggle. "Registrant" = the lobbying
            firm that files; "client" = the organization being lobbied
            for. They hit different LDA indexes server-side. */}
        <div
          className="flex rounded-lg overflow-hidden border"
          style={{ borderColor: "var(--color-border)" }}
        >
          {(
            [
              { value: "registrant", label: "Lobbying firm (registrant)" },
              { value: "client", label: "Client organization" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={search.isPending}
              onClick={() => setSearchType(opt.value)}
              className="px-3 py-2 text-xs font-heading font-semibold transition-colors"
              style={
                searchType === opt.value
                  ? { background: "var(--color-navy)", color: "white" }
                  : {
                      background: "var(--color-surface)",
                      color: "var(--color-text-muted)",
                    }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={search.isPending || !name.trim()}
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg text-xs font-heading font-semibold text-white disabled:opacity-50 disabled:cursor-wait"
          style={{ background: "var(--color-navy)" }}
        >
          {search.isPending ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Live LDA crawl takes a while — say so instead of looking hung. */}
      {search.isPending && (
        <div className="mt-3 flex items-center gap-2 text-xs text-text-faint">
          <span
            className="inline-block w-3 h-3 rounded-full border-2 animate-spin"
            style={{
              borderColor: "var(--color-navy)",
              borderTopColor: "transparent",
            }}
          />
          Searching the Senate LDA database… this can take up to 20 seconds.
        </div>
      )}

      {/* Inline error — 422 "no activity" lands here, never as a toast. */}
      {inlineError && (
        <div className="mt-3 rounded-lg border border-red bg-red-light px-3 py-2 text-xs text-text">
          {inlineError}
        </div>
      )}

      {savedName && !results && (
        <div className="mt-3 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: "var(--color-green)",
            background: "var(--color-green-light)",
          }}
        >
          <span className="font-semibold">{savedName}</span> saved. Pick it
          from the client lens dropdown on any memo.
        </div>
      )}

      {/* Step 2 — results: pick clusters, name the profile, Save */}
      {results && (
        <div className="mt-4">
          <div className="text-xs text-text-muted mb-3">
            Found{" "}
            <span className="font-semibold">{results.filing_count}</span>{" "}
            filing{results.filing_count === 1 ? "" : "s"} across{" "}
            <span className="font-semibold">{results.clusters.length}</span>{" "}
            issue area{results.clusters.length === 1 ? "" : "s"} (
            {results.years.join(", ")}). Toggle off any that shouldn't drive
            client notes.
          </div>

          <ClusterPicker
            clusters={results.clusters}
            selected={selectedCodes}
            onToggle={toggleCode}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-xs font-heading font-semibold text-text-muted">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-border text-sm focus:outline-none"
              style={{ background: "var(--color-bg)" }}
            />
            <button
              type="button"
              disabled={create.isPending || selectedCodes.size === 0}
              onClick={handleSave}
              title={
                selectedCodes.size === 0
                  ? "Select at least one issue area"
                  : undefined
              }
              className="px-4 py-2 rounded-lg text-xs font-heading font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--color-green)" }}
            >
              {create.isPending ? "Saving…" : "Save client"}
            </button>
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => {
                setResults(null);
                setInlineError(null);
              }}
              className="px-3 py-2 rounded-lg text-xs font-heading font-semibold border border-border text-text-muted hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export function ClientSettings() {
  const clientsQuery = useClients();
  const profiles = clientsQuery.data?.clients ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <div className="text-xs font-heading font-semibold uppercase tracking-widest text-navy mb-2">
              Settings
            </div>
            <h2
              className="font-brand text-3xl font-extrabold tracking-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Client profiles
            </h2>
            <p className="mt-2 text-sm text-text-faint max-w-2xl">
              Save the firms or organizations you lobby for. Readout pulls
              their disclosed issue areas from Senate LDA filings, and any
              memo can then be read through that client's lens — short
              notes pinned to the passages that touch their priorities.
            </p>
          </div>
          <Link
            to="/"
            className="text-xs font-heading font-semibold text-navy hover:underline whitespace-nowrap ml-6"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* React Query v5: gate on isPending (not isLoading) — isLoading
            is false on first render before the fetch fires (ML-534). */}
        {clientsQuery.isPending && (
          <div className="text-sm text-text-faint">Loading client profiles…</div>
        )}

        {clientsQuery.error && !clientsQuery.isPending && (
          <div className="rounded-lg border border-red bg-red-light px-4 py-3 text-sm text-text">
            Couldn't load client profiles: {clientsQuery.error.message}
          </div>
        )}

        {!clientsQuery.isPending && !clientsQuery.error && (
          <div className="space-y-6">
            {profiles.length === 0 ? (
              <div
                className="rounded-lg border border-dashed px-4 py-5 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface)",
                }}
              >
                <div className="font-heading font-semibold text-text mb-1">
                  No client profiles yet.
                </div>
                <div className="text-text-muted">
                  Add one below to unlock client-lens notes on hearing memos.
                </div>
              </div>
            ) : (
              <section>
                <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
                  Your clients
                </h3>
                <ul className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-[var(--color-border)]">
                  {profiles.map((profile) => (
                    <ProfileRow key={profile.id} profile={profile} />
                  ))}
                </ul>
              </section>
            )}

            <AddClientFlow />
          </div>
        )}
      </main>
    </div>
  );
}
