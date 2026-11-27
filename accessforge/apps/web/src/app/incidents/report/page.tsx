import type { Metadata } from "next";
import { IncidentForm } from "@/components/community/IncidentForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Report an incident" };

export default function Page() {
  return (
    <>
      <PageHeader title="Report an incident" eyebrow="Neighborhood">
        Crashes, fires, break-ins, hazards: neighbors in the ZIP code get an alert.
      </PageHeader>
      <IncidentForm />
    </>
  );
}
