import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      next: { rootDir: "frontend/" },
    },
  },
  {
    files: ["frontend/components/**/*.{ts,tsx}", "frontend/lib/**/*.{ts,tsx}"],
    rules: {
      // Client modules must not acquire provider credentials or Node capabilities.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "groq-sdk",
              message: "Call the server API through generation-client instead.",
            },
          ],
          patterns: [
            {
              group: [
                "node:*",
                "**/backend/lib/groq",
                "**/backend/lib/groq.ts",
              ],
              message: "Keep server capabilities behind the API boundary.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tooling/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "frontend/.next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".vinext/**",
    ".cloudflare/**",
    ".wrangler/**",
    "next-env.d.ts",
    "frontend/next-env.d.ts",
  ]),
]);

export default eslintConfig;
