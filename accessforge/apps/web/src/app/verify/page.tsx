import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReviewDashboard } from "@/components/verify/ReviewDashboard";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/verify");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.label}>
        Inspect submitted reports and their evidence provenance. Pending reports are shown
        initially.
      </PageHeader>
      <ReviewDashboard />
    </>
  );
}
