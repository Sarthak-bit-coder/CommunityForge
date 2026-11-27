"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { isReportId } from "@/lib/reports-api";
import { LandmarkSearch } from "./LandmarkSearch";

const purposes = {
  essential_services: "Reach essential services",
  public_transit: "Connect to public transit",
  education: "Reach a school or library",
  recreation: "Visit a park or recreation center",
  community_access: "Take part in community activities",
};
const kinds = {
  field_obstructed: "Field visit: obstruction observed",
  field_clear: "Field visit: crossing observed clear",
  city_repair_record: "City repair record",
  report_linked: "Linked barrier report",
};
type Purpose = keyof typeof purposes;
type Kind = keyof typeof kinds;
type Landmark = { key: string; name: string };
type Trip = {
  id: string;
  start_name: string;
  end_name: string;
  purpose: Purpose;
  field_nominated: boolean;
  supports: number;
};
type Catalog = { landmarks: Landmark[]; trips: Trip[] };
type Evidence = {
  kind: Kind;
  observed_on: string;
  reference: string | null;
  recorded_at: string;
  report_id?: string | null;
};
type Analysis = {
  baseline_reachable: boolean;
  combined_reachable: boolean;
  length_m: number | null;
  edge_ids: string[];
  crossings: {
    node_id: string;
    barrier_ids: string[];
    alone_reachable: boolean;
    location: string;
  }[];
  coverage_gap_edge_ids: string[];
  attribution: string[];
  coverage_note: string;
};
type Detail = Trip & { created_at: string; events: Evidence[]; analysis: Analysis | null };
const TIMEOUT = 15000;
const MISSING_ERROR_ID = "trip-missing-error";
const card = "af-panel min-w-0 space-y-4 p-4 sm:p-6";
const tripLink = (id: string) => `/trips?trip=${encodeURIComponent(id)}`;
const label = (trip: Trip) => `${trip.start_name} to ${trip.end_name}`;

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta: { page: number; limit: number; total: number } }> {
  const timeout = AbortSignal.timeout(TIMEOUT);
  let response: Response;
  try {
    response = await fetch(`/api/trips${path}`, {
      ...options,
      cache: "no-store",
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });
  } catch {
    throw new Error("Cannot reach the trip service. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error("This request is not authorized. Reload the page and try again.");
    // Only "/{id}" lookups can miss a record; a 404 on the catalog means the service is absent.
    if (response.status === 404)
      throw new Error(
        path.startsWith("/")
          ? "This trip or linked record could not be found."
          : "The trip service is not available right now. Please try again later.",
      );
    if (response.status === 422)
      throw new Error(
        "These landmarks or this purpose are no longer available. Reload to see current choices.",
      );
    if (response.status === 429)
      throw new Error("Too many requests. Please wait before trying again.");
    throw new Error("The trip service could not complete the request.");
  }
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || !result.data)
    throw new Error("The trip service returned an unreadable response.");
  return result;
}
const post = <T,>(path: string, value: unknown) =>
  request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });

function useRead<T>(path: string) {
  const [result, setResult] = useState<{
    data?: T;
    meta?: { page: number; limit: number; total: number };
    error?: string;
  }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setResult({ error: err.message });
      });
    return () => controller.abort();
  }, [path, attempt]);
  return {
    ...result,
    reload: () => {
      setResult({});
      setAttempt((n) => n + 1);
    },
  };
}

function useWrite() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The request failed. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className={card}>
      <p role="alert">{message}</p>
      <button type="button" className="af-button-secondary" onClick={retry}>
        Retry
      </button>
    </div>
  );
}

function Nominate({
  landmarks,
  refresh,
}: {
  landmarks: Landmark[];
  refresh: (id: string) => void;
}) {
  const [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const action = useWrite();
  const [wasAttempted, setWasAttempted] = useState(false);
  const invalid = start !== "" && start === end;
  const isMissing = wasAttempted && (!start || !end);
  const counts = new Map<string, number>();
  for (const { name } of landmarks) counts.set(name, (counts.get(name) ?? 0) + 1);
  // Same-named landmarks carry their OSM reference so each choice is unambiguous.
  const options = landmarks.map((l) => ({
    key: l.key,
    label: counts.get(l.name) === 1 ? l.name : `${l.name} (${l.key})`,
  }));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    setWasAttempted(true);
    if (!start || !end || invalid) return;
    await action.run(async () => {
      const { data: created } = await post<{ id: string }>("", {
        start_key: start,
        end_key: end,
        purpose: fields.get("purpose"),
        source: "online",
      });
      if (!isReportId(created?.id))
        throw new Error(
          "Submission returned no valid trip reference. Check the list before retrying.",
        );
      refresh(created.id);
    });
  }
  return (
    <form className={card} onSubmit={submit}>
      <h2 className="af-h2">Nominate a trip</h2>
      {landmarks.length < 2 ? (
        <p>Two mapped public landmarks are needed before nominations can open.</p>
      ) : (
        <>
          <p className="text-muted">
            Your landmarks and trip purpose will be public. No name or home address is needed.
          </p>
          <fieldset disabled={action.busy} className="min-w-0 space-y-4">
            <legend className="sr-only">Trip nomination</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <LandmarkSearch
                label="Start landmark"
                options={options}
                value={start}
                onChange={setStart}
                isInvalid={isMissing && !start}
                describedBy={isMissing && !start ? MISSING_ERROR_ID : undefined}
              />
              <LandmarkSearch
                label="End landmark"
                options={options}
                value={end}
                onChange={setEnd}
                isInvalid={invalid || (isMissing && !end)}
                describedBy={
                  invalid ? "trip-ends-error" : isMissing && !end ? MISSING_ERROR_ID : undefined
                }
              />
            </div>
            {invalid && (
              <p id="trip-ends-error" role="alert">
                Choose two different landmarks.
              </p>
            )}
            {isMissing && (
              <p id={MISSING_ERROR_ID} role="alert">
                Search for and choose both a start and an end landmark.
              </p>
            )}
            <label className="af-label">
              Why this trip matters
              <select className="af-select" name="purpose" required>
                <option value="">Choose a purpose</option>
                {Object.entries(purposes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="af-button-primary" disabled={action.busy || invalid}>
              {action.busy ? "Submitting…" : "Nominate trip"}
            </button>
          </fieldset>
          {action.error && <p role="alert">{action.error}</p>}
        </>
      )}
    </form>
  );
}

function SavedTrips({
  data,
  page,
  total,
  limit,
  onPage,
}: {
  data: Trip[];
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  return (
    <>
      <p className="text-sm text-muted" role="status">
        {total} saved {total === 1 ? "trip" : "trips"}
        {total > limit ? ` · Page ${page} of ${Math.ceil(total / limit)}` : ""}
      </p>
      {data.length ? (
        <ul className="divide-y divide-line">
          {data.map((t) => (
            <li key={t.id} className="py-3">
              <Link
                className="af-link inline-flex min-h-11 items-center break-words"
                href={tripLink(t.id)}
              >
                {label(t)}
              </Link>
              <p className="text-sm text-muted">
                {purposes[t.purpose]}
                {t.field_nominated ? " · Field nomination" : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {total
            ? "This page has no trips."
            : "No trips saved yet. Nominate the first trip between two landmarks."}
        </p>
      )}
      {(page > 1 || page * limit < total) && (
        <nav aria-label="Saved trip pages" className="flex flex-wrap gap-2">
          <button
            type="button"
            className="af-button-secondary"
            disabled={page === 1}
            onClick={() => onPage(page - 1)}
          >
            Previous trips
          </button>
          <button
            type="button"
            className="af-button-secondary"
            disabled={page * limit >= total}
            onClick={() => onPage(page + 1)}
          >
            Next trips
          </button>
        </nav>
      )}
    </>
  );
}

function SavedPage({ page, onPage }: { page: number; onPage: (p: number) => void }) {
  const { data, meta, error, reload } = useRead<Catalog>(`?page=${page}`);
  if (error) return <Failure message={error} retry={reload} />;
  if (!data) return <p role="status">Loading saved trips…</p>;
  if (!Array.isArray(data.trips) || !meta?.limit)
    return <Failure message="Saved trips could not be read." retry={reload} />;
  return (
    <SavedTrips
      data={data.trips}
      page={page}
      total={meta.total}
      limit={meta.limit}
      onPage={onPage}
    />
  );
}

function Board() {
  const { data, meta, error, reload } = useRead<Catalog>("");
  const [receipt, setReceipt] = useState("");
  const receiptLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (receipt) receiptLink.current?.focus();
  }, [receipt]);
  const [page, setPage] = useState(1);
  return (
    <div className="space-y-4">
      {receipt && (
        <div role="status" className="rounded-xl border border-success bg-success-soft p-4">
          <strong>Trip saved.</strong>{" "}
          <Link
            className="af-link inline-flex min-h-11 items-center"
            ref={receiptLink}
            href={tripLink(receipt)}
          >
            View saved trip
          </Link>
        </div>
      )}
      {error ? (
        <Failure message={error} retry={reload} />
      ) : !data ? (
        <p role="status">Loading community trips…</p>
      ) : !Array.isArray(data.landmarks) || !Array.isArray(data.trips) || !meta?.limit ? (
        <Failure message="The trip catalog could not be read." retry={reload} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Nominate
            landmarks={data.landmarks}
            refresh={(id) => {
              setReceipt(id);
              setPage(1);
              reload();
            }}
          />
          <section aria-labelledby="saved-trips" className={card}>
            <h2 id="saved-trips" className="af-h2">
              Saved community trips
            </h2>
            {page === 1 ? (
              <SavedTrips
                data={data.trips}
                page={1}
                total={meta.total}
                limit={meta.limit}
                onPage={setPage}
              />
            ) : (
              <SavedPage key={page} page={page} onPage={setPage} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Options({ model }: { model: Analysis | null }) {
  return (
    <section className={card}>
      <h2 className="af-h2">What would unlock this trip?</h2>
      {!model ? (
        <p>Mapped trip analysis is unavailable for these landmarks.</p>
      ) : (
        <>
          <p>
            {model.baseline_reachable
              ? "A connection exists in the current model."
              : "The current model finds no step-free connection."}
          </p>
          {!!model.crossings.length && (
            <>
              <h3 className="font-semibold">Modeled crossing options</h3>
              <ul className="space-y-2">
                {model.crossings.map((c) => (
                  <li key={c.node_id} className="break-words">
                    <strong>{c.location || c.node_id}</strong> — fixing this crossing alone:{" "}
                    {c.alone_reachable ? "modeled connection found" : "no modeled connection"}.
                  </li>
                ))}
              </ul>
              <p>
                Fixing all listed crossings together:{" "}
                {model.combined_reachable ? "modeled connection found" : "no modeled connection"}.
              </p>
            </>
          )}
          {model.length_m !== null && <p>Modeled path length: {Math.round(model.length_m)} m.</p>}
          <p>{model.coverage_note}</p>
          {!!model.coverage_gap_edge_ids.length && (
            <details>
              <summary className="cursor-pointer min-h-11">
                Segments with sidewalk coverage gaps ({model.coverage_gap_edge_ids.length})
              </summary>
              <ul className="list-disc pl-5 break-all">
                {model.coverage_gap_edge_ids.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </details>
          )}
          {!!model.attribution.length && (
            <p className="text-sm text-muted">Map sources: {model.attribution.join("; ")}</p>
          )}
          <p className="text-sm text-muted">
            Modeled results are estimates. Conditions along this trip require on-site verification.
          </p>
        </>
      )}
    </section>
  );
}

function cityRecord(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "fremont.gov" || url.hostname.endsWith(".fremont.gov"))
    );
  } catch {
    return false;
  }
}

function TripEvidence({ detail }: { detail: Detail }) {
  return (
    <section className={card}>
      <h2 className="af-h2">Public repair follow-up</h2>
      <p>
        Nominated <time dateTime={detail.created_at}>{detail.created_at.slice(0, 10)}</time>.
      </p>
      {detail.events.length === 0 ? (
        <p>No field checks, linked reports, or city repair records have been added.</p>
      ) : (
        <ol className="space-y-2">
          {detail.events.map((e, index) => {
            const report = e.report_id ?? e.reference;
            return (
              <li key={`${e.recorded_at}-${index}`}>
                <time dateTime={e.observed_on}>{e.observed_on}</time> ·{" "}
                {kinds[e.kind] ?? "Evidence entry"}
                {e.kind === "city_repair_record" && cityRecord(e.reference) && (
                  <p>
                    <a href={e.reference!} className="af-link">
                      Read city record
                    </a>
                  </p>
                )}
                {e.kind === "report_linked" && isReportId(report) && (
                  <p>
                    <Link href={`/report/track?id=${report}`} className="af-link">
                      Open linked barrier report
                    </Link>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function SelectedTrip({ id }: { id: string }) {
  const { data, error, reload } = useRead<Detail>(`/${id}`);
  if (error) return <Failure message={error} retry={reload} />;
  if (!data) return <p role="status">Loading nominated trip…</p>;
  if (data.id !== id) return <p role="alert">Could not match this trip to its record.</p>;
  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className="af-h2">{label(data)}</h2>
        <p>
          {purposes[data.purpose]}
          {data.field_nominated ? " · Nominated in the field" : ""}
        </p>
      </section>
      <Options model={data.analysis} />
      <TripEvidence detail={data} />
    </div>
  );
}

export function CommunityTrips({ initialTripId = null }: { initialTripId?: string | null }) {
  if (initialTripId === null) return <Board />;
  return (
    <div className="space-y-4">
      <Link className="af-link inline-flex min-h-11 items-center" href="/trips">
        All community trips
      </Link>
      {isReportId(initialTripId) ? (
        <SelectedTrip key={initialTripId} id={initialTripId} />
      ) : (
        <p role="alert">Invalid trip link.</p>
      )}
    </div>
  );
}
