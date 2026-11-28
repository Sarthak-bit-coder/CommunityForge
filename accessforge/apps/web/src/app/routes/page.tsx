import type { Metadata } from "next";
import { SectionHome } from "@/components/layout/SectionHome";

export const metadata: Metadata = { title: "Route issues" };

export default function Page() {
  return <SectionHome id="routes" />;
}
