import type { Metadata } from "next";
import { RepairPlanner } from "@/components/planner/RepairPlanner";
import { AccessStory, PLANNER_ID } from "@/components/planner/AccessStory";
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
      {/* The streets come first; the planner below decides which of their barriers to fix. */}
      <section aria-labelledby="planner-network-heading" className="mb-16">
        <h2 id="planner-network-heading" className="af-h2">
          Why one repair matters
        </h2>
        <div className="mt-8">
          <AccessStory />
        </div>
      </section>
      {/* Focus target for the story's "Go to the planner" button. */}
      <div id={PLANNER_ID} tabIndex={-1} className="scroll-mt-6 outline-none">
        <RepairPlanner />
      </div>
    </>
  );
}
