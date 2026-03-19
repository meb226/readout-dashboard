import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { triggerProcessing } from "../api/client";
import { useProcessingStatus } from "../hooks/useProcessingStatus";
import { HearingStatus } from "../types/api";

interface ProcessButtonProps {
  eventId: string;
  status: HearingStatus;
}

export function ProcessButton({ eventId, status }: ProcessButtonProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Poll while preparing or processing
  const isActive = status === HearingStatus.PREPARING || status === HearingStatus.PROCESSING;
  const { data: progress } = useProcessingStatus(eventId, isActive);

  async function handleProcess() {
    setIsTriggering(true);
    setError(null);
    try {
      await triggerProcessing(eventId);
      // Invalidate to refresh status
      queryClient.invalidateQueries({ queryKey: ["hearings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to trigger processing");
    } finally {
      setIsTriggering(false);
    }
  }

  // Show progress bar when actively processing
  if (isActive && progress) {
    const pct = progress.progress_percent;
    return (
      <div className="flex items-center gap-2 min-w-[140px]">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: status === HearingStatus.PREPARING ? "#B8860B" : "#0039A6",
            }}
          />
        </div>
        <span className="text-xs text-text-muted font-heading w-8 text-right">{pct}%</span>
      </div>
    );
  }

  // Ready state: show Process button
  if (status === HearingStatus.READY) {
    return (
      <div>
        <button
          onClick={handleProcess}
          disabled={isTriggering}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-navy rounded hover:bg-[#002d85] transition-colors disabled:opacity-50 font-heading"
        >
          {isTriggering ? "Starting..." : "Process"}
        </button>
        {error && <p className="text-xs text-red mt-1">{error}</p>}
      </div>
    );
  }

  return null;
}
