import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// AGENTS.md: at least 80% coverage per package.
const COVERAGE_THRESHOLD = 80;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Root layout loads next/font, which only runs under Next; Playwright covers it.
      // The 3D route scene needs WebGL, which jsdom lacks; Playwright renders it.
      exclude: [
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/app/layout.tsx",
        "src/components/home/RepairRouteScene.tsx",
      ],
      reporter: ["text", "html"],
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
      },
    },
  },
});
