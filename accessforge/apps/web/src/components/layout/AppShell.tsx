import Link from "next/link";
import type { ReactNode } from "react";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { DISCLAIMERS } from "@/lib/disclaimers";
import { CommandPalette } from "./CommandPalette";
import { Navigation } from "./Navigation";

export const MAIN_CONTENT_ID = "main-content";

// Navy sidebar on wide screens, a top bar with a menu on small ones. Pages that render a
// `data-layout="wide"` workspace (the map views) drop the reading-width limit.
export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    // One motion provider for the whole app; it honours the visitor's reduced-motion setting.
    <MotionRoot>
      <div className="min-h-full lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold focus:text-accent"
        >
          Skip to main content
        </a>
        {/* Sticky only beside content on wide screens; on phones a sticky bar would hide focus. */}
        {/* The teal page ring is under 3:1 on navy, so the sidebar uses its yellow indicator. */}
        <header className="relative z-30 bg-sidebar [&_:focus-visible]:outline-sidebar-accent text-sidebar-ink lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto print:hidden">
          <Navigation
            brand={
              <>
                <BrandMark />
                <Link
                  href="/"
                  className="text-lg font-bold tracking-tight whitespace-nowrap text-sidebar-ink"
                >
                  AccessForge <span className="font-normal text-sidebar-muted">AI</span>
                </Link>
              </>
            }
          />
          {/* Keyboard jump to any page; the shortcut also works on small screens. */}
          <div className="hidden px-3 pb-3 lg:block">
            <CommandPalette />
          </div>
          <p className="mt-auto hidden px-5 py-5 text-xs leading-relaxed text-sidebar-muted lg:block">
            Fremont pilot. Results are modeled estimates, not official inspections.
          </p>
        </header>
        <div className="flex min-w-0 flex-col">
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl has-[[data-layout=wide]]:max-w-none">{children}</div>
          </main>
          <footer className="border-t border-line bg-surface px-4 py-10 sm:px-6 lg:px-8 print:py-4">
            <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_2fr] md:gap-12">
              <div>
                <p className="flex items-center gap-2.5 font-bold tracking-tight text-ink">
                  <BrandMark />
                  AccessForge <span className="font-normal text-muted">AI</span>
                </p>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
                  Fremont pilot. Results are modeled estimates, not official inspections.
                </p>
              </div>
              <div>
                <h2 className="af-eyebrow">Important notes</h2>
                <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                  {DISCLAIMERS.map((text, index) => (
                    <li key={text} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="w-6 shrink-0 font-display font-semibold text-ink tabular-nums"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {text}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </MotionRoot>
  );
}

// Abstract mark: a route line passing a repaired point. Decorative.
function BrandMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
      <rect width="32" height="32" rx="9" className="fill-sidebar-raised" />
      <path
        d="M8 22c4 0 5-12 9-12s4 6 7 6"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-sidebar-accent"
      />
      <circle cx="17" cy="10" r="3" className="fill-sidebar-ink" />
    </svg>
  );
}
