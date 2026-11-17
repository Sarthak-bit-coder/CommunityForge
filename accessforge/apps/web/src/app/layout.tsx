import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// Typeface designed for low-vision readability.
const bodyFont = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: { default: "AccessForge AI", template: "%s · AccessForge AI" },
  description: "Decide which pedestrian repairs to fund first, and verify that they worked.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodyFont.variable} h-full antialiased`}>
      <body className="h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
