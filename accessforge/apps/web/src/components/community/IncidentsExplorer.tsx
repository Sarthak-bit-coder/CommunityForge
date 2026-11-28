"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { timeAgo, type Incident } from "@/lib/community-api";
import { CommunityMap, type MapPin } from "./CommunityMap";
import { useCommunity } from "./useCommunity";

type Layer = "all" | "report" | "lost" | "found";
const LAYERS: Record<Layer, string> = {
  all: "Everything",
  report: "Incidents",
  lost: "Lost",
  found: "Found",
};
const SOURCE_LABELS: Record<string, string> = {
  community: "Neighbor report",
  news: "Local news",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

function hrefFor(incident: Incident): string {
  return incident.url
    ? `/lost-found/item?id=${incident.url.split("/").pop()}`
    : `#incident-${incident.id}`;
}

export function IncidentsExplorer() {
  const [layer, setLayer] = useState<Layer>("all");
  const [showResolved, setShowResolved] = useState(false);
  const { data, error, reload } = useCommunity<Incident[]>(
    `/map${showResolved ? "?resolved=1" : ""}`,
  );
  const shown = useMemo(
    () => (data ?? []).filter((incident) => layer === "all" || incident.kind === layer),
    [data, layer],
  );
  const pins = useMemo<MapPin[]>(
    () =>
      shown.map((incident) => ({
        id: incident.id,
        lat: incident.lat,
        lng: incident.lng,
        label: `${incident.title}, ZIP ${incident.zip}`,
        href: hrefFor(incident),
        tone: incident.resolved
          ? "resolved"
          : incident.kind === "report"
            ? "incident"
            : incident.kind,
      })),
    [shown],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 font-medium text-ink">Show</legend>
          {(Object.keys(LAYERS) as Layer[]).map((value) => (
            <label
              key={value}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input
                type="radio"
                name="layer"
                value={value}
                checked={layer === value}
                onChange={() => setLayer(value)}
              />
              {LAYERS[value]}
            </label>
          ))}
        </fieldset>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => setShowResolved(event.target.checked)}
          />
          Include resolved
        </label>
        <Link href="/incidents/report" className="af-button-primary ml-auto">
          Report an incident
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
        <p role="status">Loading neighborhood posts…</p>
      ) : (
        <>
          <CommunityMap pins={pins} />
          <p role="status" className="text-muted">
            {shown.length} {shown.length === 1 ? "post" : "posts"} on the map.
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {shown.map((incident) => (
              <li key={incident.id} id={`incident-${incident.id}`} className="af-panel p-5">
                <Badge
                  label={
                    incident.resolved
                      ? "Resolved"
                      : incident.kind === "report"
                        ? (SOURCE_LABELS[incident.source] ?? "Report")
                        : incident.kind === "lost"
                          ? "Lost"
                          : "Found"
                  }
                  tone={
                    incident.resolved ? "success" : incident.kind === "report" ? "warning" : "info"
                  }
                />
                <h2 className="mt-1 text-lg font-semibold text-ink">
                  {incident.url ? (
                    <Link href={hrefFor(incident)} className="af-link">
                      {incident.title}
                    </Link>
                  ) : (
                    incident.title
                  )}
                </h2>
                <p className="mt-1 text-muted">{incident.description}</p>
                <p className="mt-2 text-sm text-muted">
                  ZIP {incident.zip}
                  {incident.created ? ` · ${timeAgo(incident.created)}` : ""}
                  {incident.sourceUrl ? (
                    <>
                      {" · "}
                      <a href={incident.sourceUrl} className="af-link" rel="noreferrer">
                        {incident.sourceName || "Source"}
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
