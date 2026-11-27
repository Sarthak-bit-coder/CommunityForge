"use client";

import Link from "next/link";
import { communityLink, timeAgo, type InboxItem } from "@/lib/community-api";
import { useCommunity } from "./useCommunity";
import { SignInPrompt } from "./SignInPrompt";

export function NotificationsList() {
  const { data, error } = useCommunity<InboxItem[]>("/notifications");
  if (error === "Please sign in first.") return <SignInPrompt action="see your alerts" />;
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading alerts…</p>;
  if (!data.length)
    return (
      <p className="text-muted">
        No alerts yet. They arrive when something happens in your ZIP code.
      </p>
    );
  return (
    <ul className="max-w-prose space-y-3">
      {data.map((item) => (
        <li key={item.id} className="af-panel p-4">
          <p className="font-semibold text-ink">
            {item.read ? null : (
              <span className="mr-2 text-xs font-bold tracking-widest text-accent uppercase">
                New
              </span>
            )}
            {item.link ? (
              <Link href={communityLink(item.link)} className="af-link">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </p>
          {item.body ? <p className="mt-1 whitespace-pre-line text-muted">{item.body}</p> : null}
          <p className="mt-1 text-sm text-muted">{timeAgo(item.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}
