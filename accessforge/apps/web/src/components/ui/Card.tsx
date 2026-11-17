import type { ReactNode } from "react";

type CardProps = {
  readonly title: string;
  readonly headingLevel?: "h2" | "h3";
  readonly children: ReactNode;
};

export function Card({ title, headingLevel: Heading = "h2", children }: CardProps) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <Heading className="text-lg font-semibold text-ink">{title}</Heading>
      <div className="mt-2 text-muted">{children}</div>
    </section>
  );
}
