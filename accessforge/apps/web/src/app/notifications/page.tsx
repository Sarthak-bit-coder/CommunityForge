import type { Metadata } from "next";
import { NotificationsList } from "@/components/community/NotificationsList";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/notifications");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.heading ?? item.label} eyebrow="Community">
        {item.description}
      </PageHeader>
      <NotificationsList />
    </>
  );
}
