// Client for the Neighborhood Watch service (community/app.py), proxied by next.config.ts from
// /api/community/* so its session cookie stays same-origin.

export type Member = {
  readonly name: string;
  readonly email: string;
  readonly zip: string | null;
  readonly phone: string | null;
  readonly notify_email: boolean;
  readonly notify_sms: boolean;
  readonly notify_whatsapp: boolean;
  readonly notify_telegram: boolean;
  readonly telegram_connected: boolean;
  readonly has_password: boolean;
};

export type Session = {
  readonly user: Member | null;
  readonly unread: number;
  readonly channels: Readonly<Record<"email" | "sms" | "whatsapp" | "telegram", boolean>>;
  /** The WhatsApp bot's number, or null when the bot isn't set up. */
  readonly whatsapp_bot: string | null;
  readonly google_enabled: boolean;
  /** Incident category key -> label. */
  readonly categories: Readonly<Record<string, string>>;
  readonly item_categories: readonly string[];
};

export type Incident = {
  readonly id: string;
  readonly kind: "report" | "lost" | "found";
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly zip: string;
  readonly lat: number;
  readonly lng: number;
  readonly image: string | null;
  readonly resolved: boolean;
  readonly source: string;
  readonly sourceUrl?: string | null;
  readonly sourceName?: string | null;
  readonly url?: string;
  readonly created: string | null;
};

export type LostItem = {
  readonly id: number;
  readonly kind: "lost" | "found";
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly zip: string;
  readonly place: string | null;
  readonly seen_on: string | null;
  readonly image_url: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly radius_m: number;
  readonly status: "open" | "closed";
  readonly created_at: string | null;
  readonly poster: string;
  readonly is_mine: boolean;
};

export type InboxItem = {
  readonly id: number;
  readonly kind: string;
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  readonly read: boolean;
  readonly created_at: string | null;
};

export type Update = {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly priority: "normal" | "urgent";
  readonly zip: string | null;
  readonly author: string | null;
  readonly created_at: string | null;
};

const REQUEST_TIMEOUT_MS = 15_000;

/** Calls the community service and returns its JSON, or throws an Error with a readable message. */
export async function communityRequest<T>(
  path: string,
  {
    body,
    method = body === undefined ? "GET" : "POST",
    signal,
  }: {
    readonly body?: unknown;
    readonly method?: string;
    readonly signal?: AbortSignal;
  } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = { "X-Requested-With": "fetch" };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(`/api/community${path}`, {
      method,
      headers,
      body: payload,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Cannot reach the neighborhood service. Please try again.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "The neighborhood service could not complete this request. Please try again.";
    throw new Error(message);
  }
  return data as T;
}

export const fetchSession = (signal?: AbortSignal) => communityRequest<Session>("/me", { signal });

/** Maps links the community service puts in alerts to pages in this app. */
export function communityLink(link: string): string {
  const lostItem = /^\/lost-found\/(\d+)$/.exec(link);
  if (lostItem) return `/lost-found/item?id=${lostItem[1]}`;
  if (link.startsWith("/reports")) return "/incidents";
  return link;
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  for (const [unit, size] of [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ] as const) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
    }
  }
  return "";
}
