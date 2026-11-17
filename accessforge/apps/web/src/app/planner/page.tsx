import type { Metadata } from "next";
import { NotBuiltYet } from "@/components/ui/NotBuiltYet";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/planner");

export const metadata: Metadata = { title: item.label };

export default function Page() {
  return <NotBuiltYet item={item} />;
}
