import type { Metadata } from "next";
import { RepairPlanner } from "@/components/planner/RepairPlanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/planner");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.label}>
        Set a budget and see which combination of repairs opens the most modeled access, and why
        ranking barriers one at a time can miss it.
      </PageHeader>
      <RepairPlanner />
    </>
  );
}
