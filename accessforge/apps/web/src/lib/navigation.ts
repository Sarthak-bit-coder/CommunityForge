export type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  /** Page heading when it differs from the short navigation label. */
  readonly heading?: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Overview",
    description: "What AccessForge does and what works today.",
    heading: "Fix the barriers that reconnect the most routes",
  },
  {
    href: "/barriers",
    label: "Barriers",
    description: "Known sidewalk barriers in the pilot area, as a list and a map.",
  },
  { href: "/report", label: "Report a barrier", description: "Tell us about a barrier you found." },
  {
    href: "/verify",
    label: "Verification queue",
    description: "Barriers waiting for a trained verifier to check them on site.",
  },
  {
    href: "/planner",
    label: "Repair planner",
    description: "Compare which repairs to fund first within a budget.",
  },
  {
    href: "/pilot",
    label: "Pilot dashboard",
    description: "Report counts, data sources, methods, and limits for the Fremont pilot.",
  },
  {
    href: "/accessibility",
    label: "Accessibility",
    description: "How we approach accessibility for this site.",
  },
];

export function findNavItem(href: string): NavItem {
  const item = NAV_ITEMS.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`No navigation item for ${href}`);
  return item;
}

export function isCurrentPath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
