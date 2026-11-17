import type { Metadata } from "next";
import { ReportForm } from "@/components/report/ReportForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/report");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.label}>Report an accessibility barrier.</PageHeader>
      <aside
        aria-label="Reporting notice"
        className="mb-8 rounded-lg border border-warning bg-warning-soft p-4 text-ink"
      >
        <Badge label="Public reports · Pending verification" tone="warning" />
        <p className="mt-2">
          Submissions are saved and publicly visible as pending reports. The map background uses
          fictional streets; confirm coordinates carefully. Do not include sensitive personal
          information. Photos are local previews only.
        </p>
      </aside>
      <ReportForm />
    </>
  );
}
