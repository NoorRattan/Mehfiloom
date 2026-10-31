import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@/lib/planner",
        replacement: fileURLToPath(
          new URL("./backend/lib/planner.ts", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./frontend", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["frontend/tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./frontend/tests/setup.tsx"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: [
        "frontend/lib/**/*.{ts,tsx}",
        "frontend/components/**/*.{ts,tsx}",
      ],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/frontend",
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
