import { ViewTransition, type ReactNode } from "react";

// Templates remount on every navigation. Route changes are transitions, so this crossfades the
// old page into the new one, and named elements (the page title) morph between pages.
// Browsers without the View Transitions API simply swap pages. Reduced motion: see globals.css.
export default function Template({ children }: { readonly children: ReactNode }) {
  return <ViewTransition>{children}</ViewTransition>;
}
