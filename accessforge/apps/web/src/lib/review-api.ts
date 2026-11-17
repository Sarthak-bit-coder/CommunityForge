// Reviewer-only calls. The access key lives in an HTTP-only cookie set by the API;
// this code never stores it and cannot read it back.

export type ReviewDecision = "verified" | "rejected";
export type Review = {
  readonly id: string;
  readonly report_id: string;
  readonly reviewer_id: string;
  readonly to_state: string;
  readonly reason: string;
  readonly reviewed_at: string;
};

export const REASON_MAX_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 15_000;
const UNAUTHORIZED = 401;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
export const SESSION_ENDED = "Your reviewer session has ended. Sign in again.";

async function call(path: string, unauthorized: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    response = await fetch(path, { ...init, signal, cache: "no-store" });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error("Cannot reach the review service. Please try again.");
  }
  if (response.ok) return response;
  if (response.status === UNAUTHORIZED) throw new Error(unauthorized);
  if (response.status === CONFLICT)
    throw new Error("This report was already reviewed. Refresh reports to see its status.");
  if (response.status === TOO_MANY_REQUESTS)
    throw new Error("Too many failed sign-in attempts. Wait a minute before trying again.");
  throw new Error("The review service could not complete this request. Please try again.");
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** The signed-in reviewer's ID, or null for a public visitor. */
export async function fetchSession(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await call("/api/reviewer/session", "signed out", { signal });
    const id: unknown = (await response.json())?.data?.reviewer_id;
    return typeof id === "string" ? id : null;
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}

export async function signIn(key: string): Promise<string> {
  const response = await call(
    "/api/reviewer/session",
    "That access key was not accepted.",
    json({ key }),
  );
  return (await response.json()).data.reviewer_id;
}

export async function signOut(): Promise<void> {
  await call("/api/reviewer/session", SESSION_ENDED, { method: "DELETE" });
}

export async function submitReview(
  reportId: string,
  status: ReviewDecision,
  reason: string,
): Promise<Review> {
  const response = await call(
    `/api/reports/${encodeURIComponent(reportId)}/reviews`,
    SESSION_ENDED,
    json({ status, reason: reason.trim() }),
  );
  return (await response.json()).data;
}

export async function fetchReviews(reportId: string, signal: AbortSignal): Promise<Review[]> {
  const response = await call(
    `/api/reports/${encodeURIComponent(reportId)}/reviews`,
    SESSION_ENDED,
    { signal },
  );
  return (await response.json()).data;
}
