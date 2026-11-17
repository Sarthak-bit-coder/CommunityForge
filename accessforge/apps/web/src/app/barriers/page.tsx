import type { Metadata } from "next";
import { ReportsExplorer } from "@/components/barriers/ReportsExplorer";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/barriers");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.label}>
        Explore barriers on a map or in the list below. Both show the same barriers and filters.
      </PageHeader>
      <ReportsExplorer />
    </>
  );
}
