export type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly description: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview", description: "Project status and what is coming next." },
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
