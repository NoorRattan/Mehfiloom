# Contributing

Use Node.js 24.x and run commands from the repository root. Install with `npm ci`, then start `npm run dev`.

Before opening a pull request, run:

```sh
npm run check
npm run test:coverage
npx playwright install chromium firefox
npm run test:browser
npm run check:secrets
npm audit --omit=dev
npm audit
```

Describe the user-visible change and relevant verification. Add regression coverage when changing money arithmetic, persistence, request handling or planning workflows. Test all three event types when editing shared controls. Check keyboard access, reduced motion and narrow screens for visual changes. The tests mock network responses, not application behavior; do not replace the real provider integration with a demo response.

Use `npm run format` for consistent source formatting; CI runs `npm run format:check`. Backend coverage gates require 95% lines, 85% branches and 95% functions. Frontend gates require 90% lines/statements/functions and 85% branches across every component and library, including the decorative renderer. Reports are local under `coverage/`; browser traces and screenshots stay in ignored test folders. Coverage shows executed paths, not semantic correctness or complete accessibility compliance.

Keep environment files, personal event exports, raw provider responses, generated evaluation reports and credentials out of commits. Follow [SECURITY.md](SECURITY.md) for vulnerabilities. Preserve bundled asset licenses and credit sources when adding media. There is currently no general reuse license for the application source.
