import type { Metadata } from "next";
import { LostFoundList } from "@/components/community/LostFoundList";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/lost-found");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.heading ?? item.label} eyebrow="Community">
        {item.description}
      </PageHeader>
      <LostFoundList />
    </>
  );
}
