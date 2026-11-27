export const NAV_GROUPS = [
  "Start",
  "Community",
  "Neighborhood",
  "Review and plan",
  "About the pilot",
] as const;
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
    href: "/incidents",
    group: "Neighborhood",
    label: "Incidents",
    description:
      "Crashes, fires, hazards and break-ins reported by neighbors and local news, on a map.",
    heading: "What's happening nearby",
  },
  {
    href: "/lost-found",
    group: "Neighborhood",
    label: "Lost and found",
    description: "Post a lost or found item. Neighbors in the ZIP code get an alert.",
  },
  {
    href: "/updates",
    group: "Neighborhood",
    label: "Updates",
    description: "Announcements from neighborhood admins.",
  },
  {
    href: "/notifications",
    group: "Neighborhood",
    label: "Alerts",
    description: "Every alert sent to you, also delivered by email, SMS, WhatsApp or Telegram.",
    heading: "Your alerts",
  },
  {
    href: "/account",
    group: "Neighborhood",
    label: "Account",
    description: "Sign in, set your ZIP code, and choose how you get alerts.",
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
