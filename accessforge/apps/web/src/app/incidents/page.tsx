import type { Metadata } from "next";
import { IncidentsExplorer } from "@/components/community/IncidentsExplorer";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/incidents");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.heading ?? item.label} eyebrow="Community">
        {item.description}
      </PageHeader>
      <IncidentsExplorer />
    </>
  );
}
