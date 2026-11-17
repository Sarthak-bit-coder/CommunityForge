import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { LiveReports } from "@/components/barriers/ReportsExplorer";
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
      <aside
        aria-labelledby="review-access-heading"
        className="mb-6 rounded-lg border border-warning bg-warning-soft p-4 text-ink"
      >
        <h2 id="review-access-heading" className="font-semibold">
          Read-only verification dashboard
        </h2>
        <p>
          Approve and reject actions are unavailable because reviewer authentication and protected
          review endpoints are not implemented. Public users cannot verify reports here.
        </p>
        <p className="mt-2">
          Pending reports await verification. Verified reports have been confirmed by a reviewer.
          Rejected reports were not accepted by a reviewer. These records are not official
          inspections.
        </p>
      </aside>
      <LiveReports initialFilter={{ type: "all", state: "unverified" }} />
    </>
  );
}
