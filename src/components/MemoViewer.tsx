import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { fetchMemo } from "../api/client";

interface MemoViewerProps {
  eventId: string;
}

export function MemoViewer({ eventId }: MemoViewerProps) {
  const { data: memo, isLoading, error } = useQuery({
    queryKey: ["memo", eventId],
    queryFn: () => fetchMemo(eventId),
  });

  if (isLoading) {
    return <p className="text-sm text-text-muted animate-pulse py-4">Loading memo...</p>;
  }

  if (error) {
    return <p className="text-sm text-red py-4">Failed to load memo.</p>;
  }

  if (!memo) return null;

  return (
    <div className="prose prose-sm max-w-none font-serif text-text leading-relaxed">
      <Markdown>{memo}</Markdown>
    </div>
  );
}
