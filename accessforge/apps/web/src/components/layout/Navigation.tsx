"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, domMax, m } from "motion/react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { MOTION_EXIT_TRANSITION, MOTION_SPRING } from "@/components/motion/motion-tokens";
import { NAV_GROUPS, NAV_ITEMS, isCurrentPath, type NavGroup } from "@/lib/navigation";

const NAV_LIST_ID = "primary-nav-list";

// 24×24 stroke icons, decorative: every link has a visible text label.
const NAV_ICONS: Record<string, readonly string[]> = {
  "/": ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  "/barriers": [
    "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z",
    "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  ],
  "/report": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 8v8M8 12h8"],
  "/trips": ["M5 7h12l-3-3m3 3-3 3M19 17H7l3-3m-3 3 3 3"],
  "/verify": ["M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z", "M9 12l2 2 4-4"],
  "/planner": ["M9 3h6v3H9z", "M7 4.5H5v16.5h14V4.5h-2", "M9 13l2 2 4-4"],
  "/routes": [
    "M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16",
  ],
  "/pilot": ["M3 21h18", "M6 17v-6M11 17V5M16 17v-9M21 17v-3"],
  "/accessibility": [
    "M12 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    "M5 9l7 1.5L19 9M12 10.5V15l-3 5M12 15l3 5",
  ],
};

// The brand shares a row with the small-screen menu button, so neither overlaps the other.
export function Navigation({ brand }: { readonly brand: ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Focus returns to the button, since the focused link may be the one unmounting.
  function closeOnEscape(event: KeyboardEvent) {
    if (event.key !== "Escape" || !isOpen) return;
    setIsOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <div onKeyDown={closeOnEscape}>
      <div className="flex min-h-16 items-center gap-3 px-4 lg:px-5 lg:pt-4">
        {brand}
        <button
          ref={menuButtonRef}
          type="button"
          className="ml-auto flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-sidebar-muted/50 px-4 font-semibold text-sidebar-ink transition-colors hover:bg-sidebar-raised lg:hidden"
          aria-expanded={isOpen}
          aria-controls={NAV_LIST_ID}
          onClick={() => setIsOpen((open) => !open)}
        >
          Menu
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            className={`size-4 stroke-current transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
      </div>
      <nav aria-label="Main" className="px-3 pb-3 lg:pt-2">
        <MotionRoot features={domMax}>
          {/* Wide screens: always rendered (server-rendered links). display:none hides it on phones. */}
          <div className="hidden lg:block">
            <NavGroups idPrefix="nav" pathname={pathname} onNavigate={() => setIsOpen(false)} />
          </div>
          {/* Phones: mounted only while open, so AnimatePresence can animate both open and close. */}
          <AnimatePresence initial={false}>
            {isOpen ? (
              <m.div
                key="mobile-nav"
                id={NAV_LIST_ID}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                // Exit is a short tween: closing should feel faster than opening.
                exit={{ opacity: 0, y: -8, transition: MOTION_EXIT_TRANSITION }}
                transition={MOTION_SPRING}
                className="max-h-[75dvh] overflow-y-auto lg:hidden"
              >
                <NavGroups
                  idPrefix="mobile-nav"
                  pathname={pathname}
                  onNavigate={() => setIsOpen(false)}
                />
              </m.div>
            ) : null}
          </AnimatePresence>
        </MotionRoot>
      </nav>
    </div>
  );
}

type NavListProps = {
  /** Keeps ids and the shared-element indicator separate between the two lists. */
  readonly idPrefix: string;
  readonly pathname: string;
  readonly onNavigate: () => void;
};

function NavGroups(props: NavListProps) {
  return NAV_GROUPS.map((group) => <NavSection key={group} group={group} {...props} />);
}

function NavSection({
  group,
  idPrefix,
  pathname,
  onNavigate,
}: NavListProps & { readonly group: NavGroup }) {
  const items = NAV_ITEMS.filter((item) => item.group === group);
  const headingId = `${idPrefix}-group-${group.toLowerCase().replaceAll(" ", "-")}`;
  // The first group is the overview alone; a visible label there would be noise.
  const isStart = group === NAV_GROUPS[0];
  return (
    <div className={isStart ? "" : "mt-5"}>
      <p
        id={headingId}
        className={
          isStart
            ? "sr-only"
            : "px-3 pb-1.5 text-[0.6875rem] font-bold tracking-[0.14em] text-sidebar-muted uppercase"
        }
      >
        {group}
      </p>
      <ul aria-labelledby={headingId} className="space-y-0.5">
        {items.map((item) => {
          const isCurrent = isCurrentPath(pathname, item.href);
          return (
            <li key={item.href} className="relative">
              {isCurrent ? (
                // Shared element: one indicator glides between links across groups.
                <m.span
                  layoutId={`${idPrefix}-active-indicator`}
                  transition={MOTION_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-sidebar-raised shadow-[inset_3px_0_0_var(--color-sidebar-accent)]"
                />
              ) : null}
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                onClick={onNavigate}
                className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium transition-colors duration-150 ${
                  isCurrent
                    ? "text-sidebar-ink"
                    : "text-sidebar-muted hover:bg-sidebar-raised/60 hover:text-sidebar-ink"
                }`}
              >
                <NavIcon href={item.href} isCurrent={isCurrent} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NavIcon({ href, isCurrent }: { readonly href: string; readonly isCurrent: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-5 shrink-0 ${isCurrent ? "stroke-sidebar-accent" : "stroke-current"}`}
    >
      {(NAV_ICONS[href] ?? []).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
