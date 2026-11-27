"use client";

import Link from "next/link";
import { useState } from "react";
import { INPUT_CLASS } from "@/components/report/ReportField";
import { Badge } from "@/components/ui/Badge";
import { timeAgo, type LostItem } from "@/lib/community-api";
import { useCommunity } from "./useCommunity";

export function LostFoundList() {
  const [kind, setKind] = useState<"all" | "lost" | "found">("all");
  const [zip, setZip] = useState("");
  const [closed, setClosed] = useState(false);
  const query = new URLSearchParams();
  if (kind !== "all") query.set("kind", kind);
  if (/^\d{5}$/.test(zip)) query.set("zip", zip);
  if (closed) query.set("closed", "1");
  const { data, error, reload } = useCommunity<LostItem[]>(`/lost-found?${query}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="lf-kind" className="font-medium text-ink">
            Show
          </label>
          <select
            id="lf-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className={INPUT_CLASS}
          >
            <option value="all">Lost and found</option>
            <option value="lost">Lost only</option>
            <option value="found">Found only</option>
          </select>
        </div>
        <div>
          <label htmlFor="lf-zip" className="font-medium text-ink">
            ZIP code
          </label>
          <input
            id="lf-zip"
            inputMode="numeric"
            value={zip}
            onChange={(event) => setZip(event.target.value.trim())}
            className={INPUT_CLASS}
            aria-describedby="lf-zip-help"
          />
          <p id="lf-zip-help" className="sr-only">
            Filters once you enter 5 digits.
          </p>
        </div>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={closed}
            onChange={(event) => setClosed(event.target.checked)}
          />
          Include reunited
        </label>
        <Link href="/lost-found/new" className="af-button-primary ml-auto">
          Post a lost or found item
        </Link>
      </div>

      {error ? (
        <p role="alert" className="font-medium text-warning">
          {error}{" "}
          <button type="button" onClick={reload} className="af-link">
            Try again
          </button>
        </p>
      ) : data === null ? (
        <p role="status">Loading posts…</p>
      ) : data.length === 0 ? (
        <p role="status" className="text-muted">
          No posts match. Lost something? Post it so neighbors can keep an eye out.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((item) => (
            <li key={item.id} className="af-panel p-5">
              <Badge
                label={
                  item.status === "closed" ? "Reunited" : item.kind === "lost" ? "Lost" : "Found"
                }
                tone={
                  item.status === "closed" ? "success" : item.kind === "lost" ? "warning" : "info"
                }
              />
              <h2 className="mt-1 text-lg font-semibold text-ink">
                <Link href={`/lost-found/item?id=${item.id}`} className="af-link">
                  {item.title}
                </Link>
              </h2>
              <p className="mt-1 line-clamp-3 text-muted">{item.description}</p>
              <p className="mt-2 text-sm text-muted">
                {item.category} · ZIP {item.zip}
                {item.place ? ` · ${item.place}` : ""} · {timeAgo(item.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
