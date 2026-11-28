import type { Metadata } from "next";
import { AccountPanel } from "@/components/community/AccountPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/account");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return (
    <>
      <PageHeader title={item.heading ?? item.label} eyebrow="Neighborhood">
        {item.description}
      </PageHeader>
      <AccountPanel />
    </>
  );
}
