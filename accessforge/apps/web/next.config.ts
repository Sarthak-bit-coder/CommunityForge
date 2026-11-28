import type { NextConfig } from "next";

import { contentSecurityPolicy } from "./src/lib/security-headers";

function originFrom(name: string, fallback: string): URL {
  const origin = new URL(process.env[name] || fallback);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(`${name} must be an HTTP(S) origin without credentials or a path.`);
  }
  return origin;
}

const nextConfig: NextConfig = {
  // Links in alerts sent by the community service point at its old page paths.
  async redirects() {
    return [
      { source: "/reports", destination: "/incidents", permanent: false },
      { source: "/lost-found/:id(\\d+)", destination: "/lost-found/item?id=:id", permanent: false },
    ];
  },
  async rewrites() {
    const origin = originFrom("API_BASE_URL", "http://127.0.0.1:8000");
    const community = originFrom("COMMUNITY_API_BASE_URL", "http://127.0.0.1:5000");
    return [
      { source: "/api/community/:path*", destination: `${community.origin}/api/:path*` },
      {
        source: "/static/uploads/:path*",
        destination: `${community.origin}/static/uploads/:path*`,
      },
      { source: "/api/trips/:path*", destination: `${origin.origin}/trips/:path*` },
      { source: "/api/reports/:path*", destination: `${origin.origin}/reports/:path*` },
      { source: "/api/planning/:path*", destination: `${origin.origin}/planning/:path*` },
      { source: "/api/reviewer/:path*", destination: `${origin.origin}/reviewer/:path*` },
      { source: "/api/feedback", destination: `${origin.origin}/feedback` },
      { source: "/api/network/streets", destination: `${origin.origin}/network/streets` },
      { source: "/api/routing/:path*", destination: `${origin.origin}/routing/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(process.env.NODE_ENV === "development"),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
  // The dev-only "N" badge sat on top of the sidebar links.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
