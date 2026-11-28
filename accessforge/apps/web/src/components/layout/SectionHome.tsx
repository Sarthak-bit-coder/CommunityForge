import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { GROUP_SECTION, NAV_ITEMS, NAV_SECTIONS, type NavSectionId } from "@/lib/navigation";

/** Landing page for one side of the site: a card for every page in that section. */
export function SectionHome({ id }: { readonly id: NavSectionId }) {
  const section = NAV_SECTIONS.find((candidate) => candidate.id === id)!;
  const items = NAV_ITEMS.filter((item) => GROUP_SECTION[item.group] === id);
  return (
    <>
      <PageHeader title={`${section.label} issues`} eyebrow={section.label}>
        {section.description}
      </PageHeader>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="af-panel block h-full p-5 transition-colors hover:border-accent"
            >
              <span className="font-semibold text-ink">{item.label}</span>
              <span className="mt-1 block text-muted">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
