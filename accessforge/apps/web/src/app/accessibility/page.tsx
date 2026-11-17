import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Accessibility" };

export default function AccessibilityPage() {
  return (
    <>
      <PageHeader title="Accessibility">
        We aim for this site to meet WCAG 2.2 Level AA. It is early in development and has not been
        audited yet.
      </PageHeader>
      <div className="space-y-5">
        <Card title="What we do">
          <ul className="list-disc space-y-1 pl-5">
            <li>Every map will have an equivalent list or table.</li>
            <li>The site works with a keyboard, with a visible focus indicator.</li>
            <li>Color is never the only way we show meaning.</li>
            <li>We respect your reduced-motion setting.</li>
          </ul>
        </Card>
        <Card title="Reporting a problem">
          <p>
            A way to report accessibility problems with AccessForge will be added before public
            launch.
          </p>
        </Card>
      </div>
    </>
  );
}
