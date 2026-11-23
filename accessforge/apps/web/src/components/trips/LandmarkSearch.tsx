"use client";

import { AnimatePresence, domMax, m } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { MOTION_EXIT_TRANSITION, MOTION_SPRING } from "@/components/motion/motion-tokens";

export type LandmarkOption = { readonly key: string; readonly label: string };

type LandmarkSearchProps = {
  readonly label: string;
  readonly options: readonly LandmarkOption[];
  /** Selected landmark key, or "" when none is chosen. */
  readonly value: string;
  readonly onChange: (key: string) => void;
  readonly isInvalid?: boolean;
  readonly describedBy?: string;
};

const NO_ACTIVE = -1;

// Searchable picker following the WAI-ARIA 1.2 combobox pattern (list autocomplete, manual selection).
export function LandmarkSearch({
  label,
  options,
  value,
  onChange,
  isInvalid = false,
  describedBy,
}: LandmarkSearchProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.key === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE);

  const needle = query.trim().toLowerCase();
  // Showing the chosen name is not a search: list everything so another pick is one click away.
  const isBrowsing = needle === "" || selected?.label === query;
  const matches = isBrowsing
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(needle));
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    if (activeIndex === NO_ACTIVE) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" });
    // optionId is derived from the stable useId value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  function choose(option: LandmarkOption) {
    setQuery(option.label);
    setIsOpen(false);
    setActiveIndex(NO_ACTIVE);
    onChange(option.key);
  }

  function edit(text: string) {
    setQuery(text);
    setIsOpen(true);
    setActiveIndex(NO_ACTIVE);
    if (value) onChange("");
  }

  function clear() {
    edit("");
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setIsOpen(true);
      setActiveIndex((index) => Math.min(Math.max(index + step, 0), matches.length - 1));
    } else if (event.key === "Enter" && isOpen) {
      const option = matches[activeIndex] ?? (matches.length === 1 ? matches[0] : undefined);
      if (!option) return;
      event.preventDefault(); // Picking a landmark must not submit the form.
      choose(option);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      setActiveIndex(NO_ACTIVE);
    }
  }

  return (
    <MotionRoot features={domMax}>
      <div className="relative min-w-0">
        <label htmlFor={inputId} className="af-label">
          {label}
        </label>
        <div className="relative mt-1.5">
          <SearchIcon />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search landmarks"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex === NO_ACTIVE ? undefined : optionId(activeIndex)}
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy}
            value={query}
            onChange={(event) => edit(event.target.value)}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={handleKeyDown}
            className={`min-h-11 w-full rounded-lg border bg-surface py-2 pr-11 pl-10 text-base text-ink shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-muted hover:border-ink focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60 ${
              isInvalid ? "border-warning" : selected ? "border-accent" : "border-control"
            }`}
          />
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label={`Clear ${label.toLowerCase()}`}
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="size-4 stroke-current"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          ) : null}
        </div>

        <p role="status" className="sr-only">
          {isOpen ? matchSummary(matches.length, query) : ""}
        </p>

        <AnimatePresence>
          {isOpen ? (
            <m.div
              key="panel"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, transition: MOTION_EXIT_TRANSITION }}
              transition={MOTION_SPRING}
              style={{ transformOrigin: "top" }}
              className="absolute inset-x-0 z-30 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-lift"
            >
              {matches.length ? (
                <ul
                  id={listId}
                  role="listbox"
                  aria-label={label}
                  className="max-h-72 overflow-y-auto p-1.5"
                >
                  {matches.map((option, index) => {
                    const isActive = index === activeIndex;
                    const isSelected = option.key === value;
                    return (
                      <li
                        key={option.key}
                        id={optionId(index)}
                        role="option"
                        aria-selected={isSelected}
                        // mousedown, not click: keeps focus in the input so blur does not close first.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                        onMouseMove={() => setActiveIndex(index)}
                        className="relative flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink"
                      >
                        {isActive ? (
                          <m.span
                            layoutId={`${id}-active`}
                            transition={MOTION_SPRING}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-lg bg-accent-soft"
                          />
                        ) : null}
                        <span className="relative min-w-0 flex-1 break-words">
                          <Highlighted text={option.label} needle={isBrowsing ? "" : needle} />
                        </span>
                        {isSelected ? <CheckIcon /> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p aria-hidden="true" className="px-4 py-5 text-sm text-muted">
                  No landmark matches “{query.trim()}”. Try a street, park or building name.
                </p>
              )}
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionRoot>
  );
}

function matchSummary(count: number, query: string): string {
  if (count === 0) return `No landmark matches “${query.trim()}”.`;
  return `${count} ${count === 1 ? "landmark matches" : "landmarks match"}. Use the arrow keys to choose.`;
}

// The matched part is emphasised; textContent stays the plain label for assistive tech.
function Highlighted({ text, needle }: { readonly text: string; readonly needle: string }) {
  const start = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (start === -1) return text;
  const end = start + needle.length;
  return (
    <>
      {text.slice(0, start)}
      <strong className="rounded-sm bg-marker/35 font-bold text-ink">
        {text.slice(start, end)}
      </strong>
      {text.slice(end)}
    </>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 stroke-muted"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L17 17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative size-4 shrink-0 stroke-accent"
    >
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}
