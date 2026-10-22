# Mehfiloom backend

This checkout contains the event-planning API and shared planning logic. The frontend pages, layouts, components, styles, icon, browser tests, and UI-specific tooling have been removed.

## Run locally

Use Node.js 22.6 or later and npm:

```bash
npm ci
npm run dev
```

The remaining application endpoint is `POST /api/generate`. There is no authored homepage or planner interface in this checkout.

Live generation requires the server-side `GROQ_API_KEY` described in `.env.example`. Keep environment files and key values out of source control. This frontend removal does not change the provider adapter or its request contract.

## Remaining code

- `app/api/generate/route.ts`: planning endpoint.
- `lib/generation-endpoint.ts`: request validation, body-size limits, generic errors and the process-local request limit.
- `lib/planner.ts`, `lib/schedule.ts`: event brief/proposal schemas, exact budget allocation and scheduling rules.
- `lib/plan-store.ts`, `lib/plan-revisions.ts`, `lib/plan-storage.ts`: reusable plan records, revision rules and storage adapters.
- `tests/`: domain and mocked endpoint/provider tests.

Generated planning text remains unverified. Historical model evaluation found semantic failures; schema validity does not prove affordability, availability, dietary safety or compliance with host requirements. Production rate-limit enforcement across instances, provider quotas and timeout behavior remain unverified. The in-memory limiter does not coordinate across server instances.

## Checks

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit --incremental false
npm run build
npm audit --omit=dev
```

CI retains the domain/endpoint tests, lint, type-check, production build and dependency audit gates. Frontend browser tests have been removed with the UI. The full audit tracks the known development-only `braces` advisory using `scripts/report-full-audit.mjs`.

## License

No license is currently provided. Ask the repository owner before reusing or redistributing this project.
