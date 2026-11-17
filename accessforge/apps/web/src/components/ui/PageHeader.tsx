import type { ReactNode } from "react";

export function PageHeader({
  title,
  children,
}: {
  readonly title: string;
  readonly children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
      {children ? <div className="mt-2 max-w-prose text-lg text-muted">{children}</div> : null}
    </header>
  );
}
