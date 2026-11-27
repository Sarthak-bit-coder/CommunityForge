"use client";

import { useState, type FormEvent } from "react";
import { INPUT_CLASS } from "@/components/report/ReportField";
import { Badge } from "@/components/ui/Badge";
import { communityRequest, timeAgo, type LostItem, type Session } from "@/lib/community-api";
import { CommunityMap } from "./CommunityMap";
import { SignInPrompt } from "./SignInPrompt";
import { useCommunity } from "./useCommunity";

export function LostItemDetail({ id }: { readonly id: string }) {
  const item = useCommunity<LostItem>(`/lost-found/${encodeURIComponent(id)}`);
  const session = useCommunity<Session>("/me");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (item.error) return <p role="alert">{item.error}</p>;
  if (!item.data || !session.data) return <p role="status">Loading post…</p>;
  const post = item.data;
  const open = post.status === "open";

  async function act(path: string, body: unknown, done: (value: unknown) => void) {
    setBusy(true);
    setResult(null);
    try {
      done(await communityRequest(path, { body }));
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : "Please try again." });
    }
    setBusy(false);
  }

  function contact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void act(`/lost-found/${post.id}/contact`, { message: message.trim() }, (value) => {
      setMessage("");
      setResult({ ok: true, text: (value as { message: string }).message });
    });
  }

  return (
    <article className="max-w-prose space-y-5">
      <div>
        <Badge
          label={open ? (post.kind === "lost" ? "Lost" : "Found") : "Reunited"}
          tone={open ? (post.kind === "lost" ? "warning" : "info") : "success"}
        />
        <p className="mt-1 text-muted">
          {post.category} · ZIP {post.zip}
          {post.place ? ` · ${post.place}` : ""}
          {post.seen_on ? ` · ${post.seen_on}` : ""} · posted by {post.poster}{" "}
          {timeAgo(post.created_at)}
        </p>
      </div>
      {post.image_url ? (
        // Uploads come from the community service through the same-origin proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt={`Photo of ${post.title}`}
          className="max-h-96 rounded-xl border border-line"
        />
      ) : null}
      <p className="text-lg whitespace-pre-line text-ink">{post.description}</p>
      {post.lat !== null && post.lng !== null ? (
        <CommunityMap
          pins={[
            {
              id: String(post.id),
              lat: post.lat,
              lng: post.lng,
              label: `Last seen spot, within about ${post.radius_m} m`,
              href: "#",
              tone: post.kind,
            },
          ]}
        />
      ) : null}

      {!open ? null : post.is_mine ? (
        <button
          type="button"
          disabled={busy}
          className="af-button-primary"
          onClick={() =>
            void act(`/lost-found/${post.id}/close`, {}, (value) => {
              item.setData(value as LostItem);
              setResult({ ok: true, text: "Marked as reunited. Thanks for closing the loop!" });
            })
          }
        >
          Mark as reunited
        </button>
      ) : !session.data.user ? (
        <SignInPrompt
          action={post.kind === "lost" ? "tell the owner you found it" : "claim this item"}
        />
      ) : (
        <form onSubmit={contact} aria-label="Contact the poster" className="af-panel space-y-3 p-5">
          <label htmlFor="lf-message" className="font-medium text-ink">
            {post.kind === "lost" ? "I found this" : "This is mine"}: message to {post.poster}
          </label>
          <textarea
            id="lf-message"
            rows={3}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={INPUT_CLASS}
            aria-describedby="lf-message-help"
          />
          <p id="lf-message-help" className="text-sm text-muted">
            We send {post.poster} your message with your name, email and phone from your account.
          </p>
          <button type="submit" disabled={busy} className="af-button-primary">
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      )}
      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={result.ok ? "font-medium text-ink" : "font-medium text-warning"}
        >
          {result.text}
        </p>
      ) : null}
    </article>
  );
}
