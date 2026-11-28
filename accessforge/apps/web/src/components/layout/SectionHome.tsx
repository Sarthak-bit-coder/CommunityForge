import Link from "next/link";
import { MOTION_STAGGER_S } from "@/components/motion/motion-tokens";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  GROUP_SECTION,
  NAV_GROUPS,
  NAV_ITEMS,
  NAV_SECTIONS,
  type NavSectionId,
} from "@/lib/navigation";

/** Landing page for one side of the site, in the overview's numbered editorial style. */
export function SectionHome({ id }: { readonly id: NavSectionId }) {
  const section = NAV_SECTIONS.find((candidate) => candidate.id === id)!;
  const groups = NAV_GROUPS.filter((group) => GROUP_SECTION[group] === id).map((group) => ({
    group,
    items: NAV_ITEMS.filter((item) => item.group === group),
  }));
  let number = 0;
  return (
    <>
      <PageHeader title={`${section.label} issues`} eyebrow={section.label}>
        {section.description}
      </PageHeader>
      <div className="flex flex-col gap-14">
        {groups.map(({ group, items }, index) => {
          const headingId = `section-${group.toLowerCase().replaceAll(" ", "-")}`;
          return (
            <Reveal key={group} delay={index * MOTION_STAGGER_S}>
              <section aria-labelledby={headingId}>
                <h2 id={headingId} className="af-eyebrow">
                  {group}
                </h2>
                <ol className="mt-5 border-t-2 border-ink">
                  {items.map((item) => (
                    <li key={item.href} className="border-b border-line">
                      <Link
                        href={item.href}
                        className="group grid items-baseline gap-2 py-6 md:grid-cols-[3rem_1fr_auto] md:gap-8"
                      >
                        <span
                          aria-hidden="true"
                          className="font-display text-sm font-semibold text-muted tabular-nums"
                        >
                          {String(++number).padStart(2, "0")}
                        </span>
                        <span>
                          <span className="af-display text-2xl transition-colors group-hover:text-accent sm:text-3xl">
                            {item.label}
                          </span>
                          <span className="mt-2 block max-w-prose leading-relaxed text-muted">
                            {item.description}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="hidden text-2xl text-accent transition-transform duration-150 group-hover:translate-x-1 md:block"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
