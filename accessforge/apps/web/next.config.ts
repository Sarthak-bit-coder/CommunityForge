import type { NextConfig } from "next";

import { contentSecurityPolicy } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  async rewrites() {
    const origin = new URL(process.env.API_BASE_URL || "http://127.0.0.1:8000");
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      throw new Error("API_BASE_URL must be an HTTP(S) origin without credentials or a path.");
    }
    return [
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
