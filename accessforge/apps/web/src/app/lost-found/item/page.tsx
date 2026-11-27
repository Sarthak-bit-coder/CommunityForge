import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LostItemDetail } from "@/components/community/LostItemDetail";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Lost and found post" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  return (
    <>
      <PageHeader title="Lost and found post" eyebrow="Neighborhood" />
      <Suspense fallback={<p role="status">Loading post…</p>}>
        {searchParams.then(({ id }) =>
          typeof id === "string" && /^\d+$/.test(id) ? (
            <LostItemDetail key={id} id={id} />
          ) : (
            <p role="alert">This link is broken. Open the post from the lost and found list.</p>
          ),
        )}
      </Suspense>
      <Link href="/lost-found" className="af-link mt-6 inline-flex min-h-11 items-center">
        All lost and found posts
      </Link>
    </>
  );
}
