import Link from "next/link";
import type { ReactNode } from "react";
import { DISCLAIMERS } from "@/lib/disclaimers";
import { Navigation } from "./Navigation";

export const MAIN_CONTENT_ID = "main-content";

export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold focus:text-accent"
      >
        Skip to main content
      </a>
      <header className="border-b border-line bg-surface">
        <div className="flex min-h-16 items-center px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold text-ink">
            AccessForge <span className="font-normal text-muted">AI</span>
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b border-line bg-surface p-4 lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
          <Navigation />
        </aside>
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
      <footer className="border-t border-line bg-surface px-4 py-6 text-sm text-muted sm:px-6">
        <h2 className="sr-only">Important notes</h2>
        <ul className="mx-auto max-w-5xl list-disc space-y-1 pl-5">
          {DISCLAIMERS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
