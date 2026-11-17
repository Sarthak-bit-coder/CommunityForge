import { verificationState } from "./barriers";
import type { Barrier, BarrierFilter, EvidenceProvenance, BarrierType, Severity } from "./barriers";
import type { ReportDraft } from "./report";

// Public fields from FastAPI's ReportView and Envelope; no identity or photo fields.
export type Report = {
  readonly evidence: readonly EvidenceProvenance[];
  readonly id: string;
  readonly type: BarrierType;
  readonly description: string;
  readonly severity: Severity;
  readonly state?: unknown;
  readonly location: { readonly longitude: number; readonly latitude: number };
  readonly created_at: string;
};
type Envelope<T> = { data: T; meta: { page: number; limit: number; total: number } };
export const PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    response = await fetch(`/api/reports${path}`, { ...options, signal, cache: "no-store" });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error("Cannot reach the reports service. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error("Report not found.");
    if (response.status === 429)
      throw new Error("Too many submissions. Wait a minute before trying again.");
    throw new Error("The reports service could not complete this request. Please try again.");
  }
  try {
    return await response.json();
  } catch {
    throw new Error("The reports service returned an unreadable response. Please try again.");
  }
}

export function fetchReports(filter: BarrierFilter, page: number, signal: AbortSignal) {
  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filter.type !== "all") query.set("type", filter.type);
  if (filter.state !== "all") query.set("state", filter.state);
  return request<Report[]>(`?${query}`, { signal });
}
export function fetchReport(id: string, signal: AbortSignal) {
  return request<Report>(`/${encodeURIComponent(id)}`, { signal });
}
export function submitReport(draft: ReportDraft, severity: number) {
  return request<Report>("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: draft.type,
      description: draft.description.trim(),
      severity,
      location: { longitude: Number(draft.longitude), latitude: Number(draft.latitude) },
    }),
  });
}
export function reportBarrier(report: Report): Barrier {
  return {
    id: report.id,
    name: `Report ${report.id}`,
    type: report.type,
    description: report.description,
    severity: report.severity,
    state: verificationState(report.state),
    source: "community_report",
    dataKind: "report",
    evidence: report.evidence ?? [],
    location: { lng: report.location.longitude, lat: report.location.latitude },
    locationDescription: `${report.location.latitude}, ${report.location.longitude}`,
    reportedOn: report.created_at,
  };
}
