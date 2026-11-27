"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent } from "react";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";

const SHORTCUT_KEY = "k";

/** Pages whose label, description, or group contain every word typed, in navigation order. */
export function filterPages(query: string): readonly NavItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return NAV_ITEMS.filter((item) => {
    const text = `${item.label} ${item.description} ${item.group}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

// Jump to any page by typing. Ctrl+K or ⌘K opens it from anywhere; the visible button does too.
// A native modal <dialog> traps focus, closes on Escape, and returns focus to where it was.
export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const titleId = useId();
  const listId = useId();
  const results = filterPages(query);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));
  const activeItem = results[activeIndex];

  function open() {
    setQuery("");
    setActive(0);
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    // shortcut: jsdom and very old browsers lack showModal; a plain open dialog still works there.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function close() {
    const dialog = dialogRef.current;
    if (typeof dialog?.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
  }

  function go(item: NavItem) {
    close();
    router.push(item.href);
  }

  const onShortcut = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key.toLowerCase() !== SHORTCUT_KEY || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    open();
  });

  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  function moveWithKeys(event: KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    if (event.key === "ArrowDown" && count) setActive((activeIndex + 1) % count);
    else if (event.key === "ArrowUp" && count) setActive((activeIndex - 1 + count) % count);
    else if (event.key === "Enter" && activeItem) go(activeItem);
    else return;
    event.preventDefault();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-keyshortcuts="Control+K Meta+K"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-sidebar-muted/40 bg-sidebar-raised px-3 text-sm font-semibold text-sidebar-ink transition-colors hover:border-sidebar-accent"
      >
        Search pages
        <kbd className="rounded border border-sidebar-muted/50 px-1.5 font-sans text-xs text-sidebar-muted">
          Ctrl K
        </kbd>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="af-pop mx-auto mt-[12vh] w-[min(36rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift"
      >
        <h2 id={titleId} className="sr-only">
          Go to a page
        </h2>
        <input
          role="combobox"
          aria-label="Search pages"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeItem ? `${listId}-${activeIndex}` : undefined}
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={moveWithKeys}
          placeholder="Type a page name…"
          className="min-h-14 w-full border-b border-line bg-transparent px-5 text-lg outline-offset-[-3px]"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Pages"
          className="max-h-[50vh] overflow-y-auto p-2"
        >
          {results.map((item, index) => (
            <li
              key={item.href}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => go(item)}
              onPointerMove={() => setActive(index)}
              className={`cursor-pointer rounded-lg border-l-4 px-4 py-3 transition-colors duration-150 ${
                index === activeIndex ? "border-marker bg-accent-soft" : "border-transparent"
              }`}
            >
              <span className="block font-semibold">{item.label}</span>
              <span className="block text-sm text-muted">{item.description}</span>
            </li>
          ))}
        </ul>
        <p role="status" className="border-t border-line px-5 py-2 text-xs text-muted">
          {results.length
            ? `${results.length} ${results.length === 1 ? "page" : "pages"}. Arrow keys to move, Enter to open, Escape to close.`
            : "No pages match."}
        </p>
      </dialog>
    </>
  );
}
