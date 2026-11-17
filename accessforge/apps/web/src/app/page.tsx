import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { NAV_ITEMS } from "@/lib/navigation";

const SECTION_LINKS = NAV_ITEMS.filter((item) => item.href !== "/");

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview">
        AccessForge helps a community decide which pedestrian repairs to fund first, and check
        whether those repairs happened and worked. The first pilot area is in Fremont, California.
      </PageHeader>
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Project status">
          <p className="mb-3">
            <Badge label="In development" tone="warning" />
          </p>
          <p>
            Research and planning are done. The optimization engine is being built and tested on
            synthetic data.
          </p>
        </Card>
        <Card title="Barrier data">
          <p className="mb-3">
            <Badge label="No data yet" />
          </p>
          <p>No barriers are loaded. Pilot-area data arrives in a later phase.</p>
        </Card>
      </div>
      <section aria-labelledby="sections-heading" className="mt-10">
        <h2 id="sections-heading" className="text-xl font-semibold text-ink">
          Sections
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SECTION_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block h-full rounded-lg border border-line bg-surface p-4 hover:border-accent"
              >
                <span className="font-semibold text-accent underline underline-offset-4">
                  {item.label}
                </span>
                <span className="mt-1 block text-muted">{item.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
