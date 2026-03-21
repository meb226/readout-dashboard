import { useQuery } from "@tanstack/react-query";
import Markdown, { type Components } from "react-markdown";
import { fetchMemo } from "../api/client";

interface MemoViewerProps {
  eventId: string;
}

/* react-markdown component overrides — Inter headings, Lora body */
const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-heading text-[20px] font-bold tracking-tight text-[#1a1a1a] mb-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-heading text-[17px] font-bold tracking-tight mt-7 mb-1 text-[#1a1a1a]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-heading text-[14px] font-bold uppercase tracking-wider mt-6 mb-3 text-[#0039A6]">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="font-heading text-[13px] font-semibold mt-5 mb-2 text-[#444]">
      {children}
    </h4>
  ),
  hr: () => (
    <hr className="border-none h-px my-5" style={{ background: "linear-gradient(90deg, rgba(0,57,166,0.2), transparent)" }} />
  ),
  p: ({ children }) => (
    <p className="text-[15px] leading-[1.72] mb-3.5 text-[#333]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="pl-5 mb-3.5">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="text-[15px] leading-[1.72] mb-2.5 text-[#333]">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#1a1a1a]">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-[#0039A6] pl-4 py-3 my-4 bg-[rgba(0,57,166,0.03)] rounded-r-lg italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#f5f5f5]">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-[#e5e5e5]">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 font-semibold text-[#1a1a1a] text-xs">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-[#333] text-[13px]">{children}</td>
  ),
};

export function MemoViewer({ eventId }: MemoViewerProps) {
  const { data: memo, isLoading, error } = useQuery({
    queryKey: ["memo", eventId],
    queryFn: () => fetchMemo(eventId),
  });

  if (isLoading) {
    return (
      <div className="py-6 space-y-4 animate-pulse">
        <div className="h-4 rounded bg-black/5" style={{ width: "85%" }} />
        <div className="h-4 rounded bg-black/5" style={{ width: "70%" }} />
        <div className="h-4 rounded bg-black/5" style={{ width: "60%" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <p className="text-sm text-red font-medium">Failed to load memo.</p>
      </div>
    );
  }

  if (!memo) return null;

  return (
    <div className="font-serif max-w-none">
      <Markdown components={mdComponents}>{memo}</Markdown>
    </div>
  );
}
