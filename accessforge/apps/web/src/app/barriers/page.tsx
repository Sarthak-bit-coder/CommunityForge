import type { Metadata } from "next";
import { ReportsExplorer } from "@/components/barriers/ReportsExplorer";
import { findNavItem } from "@/lib/navigation";

const item = findNavItem("/barriers");

export const metadata: Metadata = { title: item.label };

// The heading lives in the explorer's side panel so the map can fill the workspace.
export default function Page() {
  return <ReportsExplorer />;
}
