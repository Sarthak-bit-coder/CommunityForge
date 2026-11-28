import type { Metadata } from "next";
import { UpdatesList } from "@/components/community/UpdatesList";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/updates");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.heading ?? item.label} eyebrow="Community">
        {item.description}
      </PageHeader>
      <UpdatesList />
    </>
  );
}
