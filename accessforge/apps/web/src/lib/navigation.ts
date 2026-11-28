/** The site is two apps in one: neighborhood issues, and accessible-route issues. */
export const NAV_SECTIONS = [
  {
    id: "community",
    label: "Community",
    href: "/community",
    description: "Incidents, lost and found, updates and alerts for your neighborhood.",
  },
  {
    id: "routes",
    label: "Routes",
    href: "/routes",
    description: "Sidewalk barriers, repair planning and route analysis for the Fremont pilot.",
  },
] as const;
export type NavSectionId = (typeof NAV_SECTIONS)[number]["id"];

export const NAV_GROUPS = [
  "Start",
  "Neighborhood",
  "You",
  "Barriers",
  "Review and plan",
  "About the pilot",
] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/** Which section's sidebar shows each group. */
export const GROUP_SECTION: Record<NavGroup, NavSectionId> = {
  Start: "routes",
  Neighborhood: "community",
  You: "community",
  Barriers: "routes",
  "Review and plan": "routes",
  "About the pilot": "routes",
};

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
    group: "Barriers",
    label: "Barriers",
    description: "Known sidewalk barriers in the pilot area, as a list and a map.",
  },
  {
    href: "/report",
    group: "Barriers",
    label: "Report a barrier",
    description: "Tell us about a barrier you found.",
  },
  {
    href: "/trips",
    group: "Barriers",
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
    group: "You",
    label: "Alerts",
    description: "Every alert sent to you, also delivered by email, SMS, WhatsApp or Telegram.",
    heading: "Your alerts",
  },
  {
    href: "/account",
    group: "You",
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
    href: "/routes/analysis",
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

/** The section a page belongs to; pages outside the list (and section homes) fall back sensibly. */
export function sectionFor(pathname: string): NavSectionId {
  if (isCurrentPath(pathname, "/community")) return "community";
  const item = NAV_ITEMS.find((candidate) => isCurrentPath(pathname, candidate.href));
  return item ? GROUP_SECTION[item.group] : "routes";
}

export function isCurrentPath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
