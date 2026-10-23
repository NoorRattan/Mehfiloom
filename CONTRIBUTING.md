# Contributing

Use Node.js 24.x and run commands from the repository root. Install with `npm ci`, then start `npm run dev`.

Before opening a pull request, run:

```sh
npm run check
npm run check:secrets
npm audit --omit=dev
node backend/scripts/report-full-audit.mjs
```

Describe the user-visible change and relevant verification. Add regression coverage when changing money arithmetic, persistence, request handling or planning workflows. Test all three event types when editing shared controls. Check keyboard access, reduced motion and narrow screens for visual changes. The tests mock network responses, not application behavior; do not replace the real provider integration with a demo response.

Keep environment files, personal event exports, raw provider responses, generated evaluation reports and credentials out of commits. Follow [SECURITY.md](SECURITY.md) for vulnerabilities. Preserve bundled asset licenses and credit sources when adding media. There is currently no general reuse license for the application source.
