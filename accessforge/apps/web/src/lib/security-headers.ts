import { BASEMAP_ORIGINS } from "./basemap";

// Content-Security-Policy for every page. Next.js prerenders these pages, so per-request nonces
// are unavailable; scripts and styles therefore allow 'unsafe-inline'. Every other directive is
// same-origin only, except connect-src: MapLibre fetches the basemap's style, vector tiles,
// glyphs, and sprites from the basemap providers. Fonts are self-hosted by next/font.
// React's development build uses eval() to rebuild call stacks for its error overlay; the
// production build never does, so only `next dev` gets 'unsafe-eval'.
export function contentSecurityPolicy(isDevelopment: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    ...SHARED_DIRECTIVES,
  ].join("; ");
}

const SHARED_DIRECTIVES = [
  "style-src 'self' 'unsafe-inline'",
  // Device-only photo previews use object URLs.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${BASEMAP_ORIGINS.join(" ")}`,
  // MapLibre runs its worker from a blob URL.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

/** The production policy. */
export const CONTENT_SECURITY_POLICY = contentSecurityPolicy(false);
