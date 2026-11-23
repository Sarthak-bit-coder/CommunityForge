import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunityTrips } from "@/components/trips/CommunityTrips";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/trips");
export const metadata: Metadata = { title: item.label };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string | string[] }>;
}) {
  return (
    <>
      <PageHeader title={item.label}>{item.description}</PageHeader>
      <Suspense fallback={<p role="status">Loading community trips…</p>}>
        {searchParams.then(({ trip }) => (
          <CommunityTrips initialTripId={Array.isArray(trip) ? "" : (trip ?? null)} />
        ))}
      </Suspense>
    </>
  );
}
