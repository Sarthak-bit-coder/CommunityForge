"use client";

/**
 * Adapted from KokonutUI "Promise Toast" v1.0.0 (MIT), https://kokonutui.com.
 * Changes: one toast at a time, no undo, stacking, swipe, counted work, or auto-dismiss; Retry
 * calls back to the caller so it re-runs its own checks; AccessForge tokens; under reduced
 * motion the spinner is a still ring and the title and mark swap without animation.
 */

import { AnimatePresence, m } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { MOTION_DURATION_S, MOTION_EASE_ENTER } from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

type Status = "loading" | "success" | "error";
/** A title, or a title and a second line. */
export type ToastLines = string | readonly [string, string];

export type ToastOptions<T> = {
  readonly loading: string;
  readonly success: ToastLines | ((value: T) => ToastLines);
  readonly error: ToastLines | ((error: unknown) => ToastLines);
  /** Offered after a failure. */
  readonly onRetry?: () => void;
};

type ToastState = {
  readonly id: number;
  readonly status: Status;
  readonly title: string;
  readonly body: string;
  readonly onRetry?: () => void;
};

const SPIN_S = 0.9;

function lines<V>(source: ToastLines | ((value: V) => ToastLines), value: V): [string, string] {
  const resolved = typeof source === "function" ? source(value) : source;
  return typeof resolved === "string" ? [resolved, ""] : [resolved[0], resolved[1]];
}

/** `show` runs the work and keeps the toast in step with it; the work's own result is returned. */
export function usePromiseToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(1);
  const show = useCallback(async <T,>(task: () => Promise<T>, options: ToastOptions<T>) => {
    const id = nextId.current++;
    setToast({ id, status: "loading", title: options.loading, body: "" });
    // Only the newest toast may change what is shown.
    const settle = (patch: Omit<ToastState, "id">) =>
      setToast((current) => (current?.id === id ? { id, ...patch } : current));
    try {
      const value = await task();
      const [title, body] = lines(options.success, value);
      settle({ status: "success", title, body });
      return value;
    } catch (error: unknown) {
      const [title, body] = lines(options.error, error);
      settle({ status: "error", title, body, onRetry: options.onRetry });
      throw error;
    }
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}

export type PromiseToaster = ReturnType<typeof usePromiseToast>;

export function Toaster({ toaster }: { readonly toaster: PromiseToaster }) {
  const { toast, dismiss } = toaster;
  const reduceMotion = usePrefersReducedMotion();
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:left-auto sm:w-96"
    >
      <AnimatePresence initial={false}>
        {toast ? (
          <m.div
            key="toast"
            className="pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-ink shadow-card"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 8 }}
            transition={{ duration: MOTION_DURATION_S.fast, ease: MOTION_EASE_ENTER }}
            onKeyDown={(event) => {
              if (event.key === "Escape") dismiss();
            }}
          >
            <StatusIcon status={toast.status} reduceMotion={reduceMotion} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{toast.title}</p>
              {toast.body ? <p className="text-sm text-muted">{toast.body}</p> : null}
            </div>
            {toast.status === "error" && toast.onRetry ? (
              <button
                type="button"
                onClick={toast.onRetry}
                className="af-button-secondary min-h-11 px-3 text-sm"
              >
                Retry
              </button>
            ) : null}
            {toast.status === "loading" ? null : (
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={dismiss}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:text-ink"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

const ICON_TONE: Record<Status, string> = {
  loading: "text-muted",
  success: "text-success",
  error: "text-warning",
};

/** One ring: it spins while working, closes when done, then draws the mark. */
function StatusIcon({
  status,
  reduceMotion,
}: {
  readonly status: Status;
  readonly reduceMotion: boolean;
}) {
  const isSpinning = status === "loading" && !reduceMotion;
  const draw = {
    duration: reduceMotion ? 0 : MOTION_DURATION_S.interactive,
    ease: "easeOut",
  } as const;
  return (
    <span
      className={`relative flex size-8 shrink-0 items-center justify-center ${ICON_TONE[status]}`}
    >
      <m.svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="size-8"
        fill="none"
        animate={{ rotate: isSpinning ? 360 : 0 }}
        transition={
          isSpinning ? { duration: SPIN_S, ease: "linear", repeat: Infinity } : { duration: 0 }
        }
      >
        <m.circle
          cx={16}
          cy={16}
          r={13}
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={2.5}
          style={{ rotate: -90, transformOrigin: "16px 16px" }}
          initial={false}
          animate={{ pathLength: isSpinning ? 0.3 : 1 }}
          transition={draw}
        />
      </m.svg>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="absolute inset-0 size-8" fill="none">
        {status === "success" ? (
          <m.path
            d="M10.5 16.5l3.6 3.5 7.4-7.6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            initial={{ pathLength: reduceMotion ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={draw}
          />
        ) : null}
        {status === "error" ? (
          <m.path
            d="M16 10v7.5M16 21.6v.1"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={2.5}
            initial={{ pathLength: reduceMotion ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={draw}
          />
        ) : null}
      </svg>
    </span>
  );
}
