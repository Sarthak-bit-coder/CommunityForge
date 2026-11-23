import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// Typeface designed for low-vision readability.
const bodyFont = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Editorial display face for headings only; body text stays hyperlegible.
const headingFont = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: { default: "AccessForge AI", template: "%s · AccessForge AI" },
  description: "Decide which pedestrian repairs to fund first, and verify that they worked.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}>
      <head>
        {/* Scroll reveals render hidden until JavaScript fades them in; without it, show them. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
      </head>
      <body className="h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
