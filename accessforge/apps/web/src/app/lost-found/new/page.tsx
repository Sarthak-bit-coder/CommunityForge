import type { Metadata } from "next";
import { LostItemForm } from "@/components/community/LostItemForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Post a lost or found item" };

export default function Page() {
  return (
    <>
      <PageHeader title="Post a lost or found item" eyebrow="Neighborhood">
        Neighbors in the ZIP code get an alert, and owners of matching lost items hear about found
        ones.
      </PageHeader>
      <LostItemForm />
    </>
  );
}
