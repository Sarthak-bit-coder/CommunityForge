"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { NAV_ITEMS, isCurrentPath } from "@/lib/navigation";

const NAV_LIST_ID = "primary-nav-list";

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) setIsOpen(false);
  }

  return (
    <nav aria-label="Main" onKeyDown={closeOnEscape}>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between rounded-md border border-line px-4 font-medium text-ink lg:hidden"
        aria-expanded={isOpen}
        aria-controls={NAV_LIST_ID}
        onClick={() => setIsOpen((open) => !open)}
      >
        Menu
        <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>
      <ul
        id={NAV_LIST_ID}
        className={`mt-2 space-y-1 lg:mt-0 lg:block ${isOpen ? "block" : "hidden"}`}
      >
        {NAV_ITEMS.map((item) => {
          const isCurrent = isCurrentPath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => setIsOpen(false)}
                className={`flex min-h-11 items-center rounded-md border-l-4 px-3 font-medium ${
                  isCurrent
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-transparent text-ink hover:bg-canvas"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
