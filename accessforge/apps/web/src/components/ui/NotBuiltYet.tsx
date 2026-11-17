import { Badge } from "./Badge";
import { Card } from "./Card";
import { PageHeader } from "./PageHeader";
import type { NavItem } from "@/lib/navigation";

export function NotBuiltYet({ item }: { readonly item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label}>{item.description}</PageHeader>
      <Card title="Not built yet">
        <p className="mb-3">
          <Badge label="Planned" tone="info" />
        </p>
        <p>
          This part of AccessForge is planned for the MVP web application and is not available yet.
        </p>
      </Card>
    </>
  );
}
