import type { NextConfig } from "next";

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
      { source: "/api/reports/:path*", destination: `${origin.origin}/reports/:path*` },
      { source: "/api/planning/:path*", destination: `${origin.origin}/planning/:path*` },
      { source: "/api/reviewer/:path*", destination: `${origin.origin}/reviewer/:path*` },
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
