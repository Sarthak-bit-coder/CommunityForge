import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReportTracking } from "@/components/report/ReportTracking";
import { PageHeader } from "@/components/ui/PageHeader";
import { isReportId } from "@/lib/reports-api";

export const metadata: Metadata = { title: "Track a report" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Track a report" />
      <Suspense fallback={<p role="status">Loading report status…</p>}>
        {searchParams.then(({ id }) =>
          isReportId(id) ? (
            <ReportTracking key={id.toLowerCase()} id={id.toLowerCase()} />
          ) : (
            <p role="alert">
              Invalid tracking link. Open the link from your submission confirmation.
            </p>
          ),
        )}
      </Suspense>
      <Link href="/barriers" className="af-link inline-flex min-h-11 items-center">
        View submitted reports
      </Link>
    </div>
  );
}
