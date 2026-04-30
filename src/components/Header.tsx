import { useStats } from "../hooks/useStats";
import { useAuth } from "../auth/AuthProvider";

async function signOut() {
  try {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // Cookie clear is best-effort; hard-reload regardless so the
    // AuthProvider re-runs against whatever cookie state is left.
  }
  window.location.assign("/login");
}

export function Header() {
  const { data: stats } = useStats();
  const { session } = useAuth();

  return (
    <header className="border-b border-border bg-surface px-8 py-5 flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <h1 className="font-brand text-xl font-extrabold tracking-tight">
          <span className="text-navy">Read</span>
          <span className="text-green">out</span>
        </h1>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-navy bg-navy-light px-2 py-0.5 rounded font-heading">
          Beta
        </span>
      </div>

      <div className="flex items-center gap-6">
        {stats && (
          <div className="flex items-center gap-4 text-xs text-text-muted font-heading">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
              {stats.ready_count} ready
            </span>
            <span>{stats.processing_count} processing</span>
            <span>{stats.complete_count} complete</span>
            <span className="text-text-faint">{stats.total_hearings} total</span>
          </div>
        )}

        {session && (
          <div className="flex items-center gap-3 text-xs font-heading">
            <span className="text-text-muted hidden sm:inline" title={session.email}>
              {session.email}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="px-3 py-1.5 rounded border border-border text-text-muted hover:text-navy hover:border-navy transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
