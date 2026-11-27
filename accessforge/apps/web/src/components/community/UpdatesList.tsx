"use client";

import { Badge } from "@/components/ui/Badge";
import { timeAgo, type Update } from "@/lib/community-api";
import { useCommunity } from "./useCommunity";

export function UpdatesList() {
  const { data, error } = useCommunity<Update[]>("/updates");
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading updates…</p>;
  if (!data.length) return <p className="text-muted">No updates right now.</p>;
  return (
    <ul className="max-w-prose space-y-4">
      {data.map((update) => (
        <li key={update.id} className="af-panel p-5">
          {update.priority === "urgent" ? <Badge label="Urgent" tone="warning" /> : null}
          <h2 className="text-lg font-semibold text-ink">{update.title}</h2>
          <p className="mt-1 whitespace-pre-line text-ink">{update.body}</p>
          <p className="mt-2 text-sm text-muted">
            {update.zip ? `ZIP ${update.zip}` : "Everyone"}
            {update.author ? ` · ${update.author}` : ""} · {timeAgo(update.created_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
