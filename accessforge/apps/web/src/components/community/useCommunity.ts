"use client";

import { useCallback, useEffect, useState } from "react";
import { communityRequest } from "@/lib/community-api";

export type Loaded<T> = {
  readonly data: T | null;
  readonly error: string;
  readonly reload: () => void;
  /** Replace the data after a write that returned the new value. */
  readonly setData: (data: T) => void;
};

/** GETs a community endpoint on mount and whenever `path` changes. */
export function useCommunity<T>(path: string): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    communityRequest<T>(path, { signal: controller.signal }).then(
      (value) => {
        setData(value);
        setError("");
      },
      (reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Could not load this page.");
      },
    );
    return () => controller.abort();
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, error, reload, setData };
}
