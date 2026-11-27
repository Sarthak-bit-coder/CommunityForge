import { ViewTransition, type ReactNode } from "react";
import { KineticTitle } from "./KineticTitle";

// Editorial page opening. The page entrance comes from app/template.tsx.
export function PageHeader({
  title,
  eyebrow = "Fremont pilot",
  children,
}: {
  readonly title: string;
  readonly eyebrow?: string;
  readonly children?: ReactNode;
}) {
  return (
    <header className="relative mb-10 border-b border-line pt-2 pb-8 sm:pt-6">
      <p className="af-eyebrow">{eyebrow}</p>
      {/* Shared element: each page's title morphs into the next one's on navigation. */}
      <ViewTransition name="page-title" share="af-morph" default="none">
        <h1 className="af-display mt-4 text-4xl leading-[1.05] sm:text-5xl">
          <KineticTitle text={title} />
        </h1>
      </ViewTransition>
      {children ? (
        <div className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{children}</div>
      ) : null}
      <span
        aria-hidden="true"
        className="af-underline-draw absolute -bottom-px left-0 h-0.5 w-16 rounded-full bg-accent"
      />
    </header>
  );
}
