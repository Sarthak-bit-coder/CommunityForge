export const NAV_GROUPS = ["Start", "Community", "Review and plan", "About the pilot"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export type NavItem = {
  readonly href: string;
  readonly group: NavGroup;
  readonly label: string;
  readonly description: string;
  /** Page heading when it differs from the short navigation label. */
  readonly heading?: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    group: "Start",
    label: "Overview",
    description: "What AccessForge does and what works today.",
    heading: "Fix the barriers that reconnect the most routes",
  },
  {
    href: "/barriers",
    group: "Community",
    label: "Barriers",
    description: "Known sidewalk barriers in the pilot area, as a list and a map.",
  },
  {
    href: "/report",
    group: "Community",
    label: "Report a barrier",
    description: "Tell us about a barrier you found.",
  },
  {
    href: "/trips",
    group: "Community",
    label: "Community Trips",
    description:
      "Nominate a trip between public Fremont landmarks and explore trips saved by the community.",
  },
  {
    href: "/verify",
    group: "Review and plan",
    label: "Verification queue",
    description: "Barriers waiting for a trained verifier to check them on site.",
  },
  {
    href: "/planner",
    group: "Review and plan",
    label: "Repair planner",
    description: "Compare which repairs to fund first within a budget.",
  },
  {
    href: "/routes",
    group: "Review and plan",
    label: "Route analysis",
    description: "Check a modeled route for a traveler, and what recommended repairs change.",
  },
  {
    href: "/pilot",
    group: "About the pilot",
    label: "Pilot dashboard",
    description: "Report counts, data sources, methods, and limits for the Fremont pilot.",
  },
  {
    href: "/accessibility",
    group: "About the pilot",
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
