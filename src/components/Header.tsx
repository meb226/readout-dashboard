import { useStats } from "../hooks/useStats";

export function Header() {
  const { data: stats } = useStats();

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
    </header>
  );
}
