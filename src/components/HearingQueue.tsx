import { useHearings } from "../hooks/useHearings";
import { HearingRow } from "./HearingRow";

interface HearingQueueProps {
  committeeId: string | null;
  selectedEventId: string | null;
  onSelectHearing: (eventId: string) => void;
}

export function HearingQueue({ committeeId, selectedEventId, onSelectHearing }: HearingQueueProps) {
  const { data, isLoading, error } = useHearings({
    committee_id: committeeId ?? undefined,
    limit: 100,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <span className="animate-pulse">Loading hearings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red">
        <span>Failed to load hearings: {error.message}</span>
      </div>
    );
  }

  if (!data?.hearings.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <span>No hearings found{committeeId ? " for this committee" : ""}.</span>
      </div>
    );
  }

  return (
    <div>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-text-muted font-heading">
          {data.total} hearing{data.total !== 1 ? "s" : ""}
        </span>
      </div>
      {data.hearings.map((h) => (
        <HearingRow
          key={h.event_id}
          hearing={h}
          isSelected={selectedEventId === h.event_id}
          onSelect={onSelectHearing}
        />
      ))}
    </div>
  );
}
