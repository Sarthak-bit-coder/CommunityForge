import type { Metadata } from "next";
import { RouteAnalysis } from "@/components/routing/RouteAnalysis";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/routes");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.label}>
        Pick a start, an end and a traveler profile. See whether a modeled route exists, which
        recorded barriers affect it, and what the recommended repairs would change.
      </PageHeader>
      <RouteAnalysis />
    </>
  );
}
