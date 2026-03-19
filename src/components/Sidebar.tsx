import { useCommittees } from "../hooks/useCommittees";
import { useStats } from "../hooks/useStats";

interface SidebarProps {
  selectedCommittee: string | null;
  onSelectCommittee: (id: string | null) => void;
}

export function Sidebar({ selectedCommittee, onSelectCommittee }: SidebarProps) {
  const { data: committees } = useCommittees();
  const { data: stats } = useStats();

  // Build a map of committee_id → hearing count from stats
  const countMap = new Map<string, number>();
  if (stats) {
    for (const c of stats.by_committee) {
      countMap.set(c.committee_id, c.count);
    }
  }

  return (
    <aside className="bg-surface border-r border-border py-6 overflow-y-auto">
      <div className="mb-7">
        <h2 className="px-5 mb-2.5 text-[10px] font-semibold uppercase tracking-[1.8px] text-text-faint font-heading">
          Committees
        </h2>

        {/* All Committees */}
        <button
          onClick={() => onSelectCommittee(null)}
          className={`w-full text-left flex items-center justify-between px-5 py-2.5 text-sm transition-colors border-l-3
            ${!selectedCommittee
              ? "bg-navy-light border-navy text-navy font-semibold"
              : "border-transparent hover:bg-[#f5f5f5] text-text"
            }`}
        >
          <span>All Committees</span>
          {stats && (
            <span className="text-xs text-text-faint">{stats.total_hearings}</span>
          )}
        </button>

        {/* Individual committees */}
        {committees?.map((c) => (
          <button
            key={c.committee_id}
            onClick={() => onSelectCommittee(c.committee_id)}
            className={`w-full text-left flex items-center justify-between px-5 py-2.5 text-sm transition-colors border-l-3
              ${selectedCommittee === c.committee_id
                ? "bg-navy-light border-navy text-navy font-semibold"
                : "border-transparent hover:bg-[#f5f5f5] text-text"
              }`}
          >
            <span className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.chamber === "senate" ? "#0039A6" : "#C0452A" }}
              />
              <span className="truncate">{c.short_name}</span>
            </span>
            <span className="text-xs text-text-faint">
              {countMap.get(c.committee_id) ?? 0}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
