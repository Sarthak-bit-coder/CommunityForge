import type { Metadata } from "next";
import { PilotDashboard } from "@/components/pilot/PilotDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/pilot");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const metadata: Metadata = { title: item.label };

export default function Page() {
  // Server-side setting; the page says so when no feedback contact is configured.
  const configured = process.env.FEEDBACK_EMAIL?.trim() ?? "";
  const feedbackEmail = EMAIL_PATTERN.test(configured) ? configured : null;
  return (
    <>
      <PageHeader title={item.label}>
        A preview of what a Fremont pilot would report: how many barriers people have submitted, how
        many a reviewer has checked, and what the numbers can and cannot tell you.
      </PageHeader>
      <PilotDashboard feedbackEmail={feedbackEmail} />
    </>
  );
}
