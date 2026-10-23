# Mehfiloom

**Make room for your kind of gathering.**

Mehfiloom helps hosts turn the first idea for an event into an editable planning draft, with a budget picture, suggested next steps, provider questions, and ideas to consider.

## Project layout

- `frontend/` contains the Next.js pages, event themes, and planner UI.
- `backend/` contains the planning domain, generation endpoint handler, provider adapter, tests, and audit scripts.
- The Next.js API route in `frontend/app/api/generate/route.ts` connects the frontend server to `backend/api/generate.ts`.

Run commands from the repository root; dependencies and the lockfile are shared.

## Event pages

- `/wedding` is a burgundy editorial experience with romantic arches and heirloom typography.
- `/birthday` is a playful lilac and citron experience with oversized lettering and party photography.
- `/community` is an earthy olive experience with welcoming photography and botanical details.
- Each event has its own `/organize` and `/assist` routes, for example `/wedding/organize` and `/wedding/assist`.
- Legacy `/planner/wedding`, `/planner/birthday`, and `/planner/community` links redirect to the corresponding organizer.

Organizers save independent drafts in browser local storage. Event details, checklists, vendor notes, and exported text plans work without an API key. The budget section can create an explicitly labelled starter allocation without an AI request. Each dedicated assistant uses the server-side Groq integration for tailored plans and revisions.

## Run locally

Use Node.js 22.6 or later and npm:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` to choose an event and explore its dedicated experience. Open its organizer to edit details and tasks, or its assistant to request a tailored draft through `POST /api/generate`.

Live generation requires the server-side `GROQ_API_KEY`. Copy `backend/.env.example` to `frontend/.env.local` and add the key there. Keep environment files and key values out of source control.

## Planning behavior

- Captures event type, name, place, optional date, attendance, currency, budget cap, style, and must-haves.
- Validates generated proposals and allocates the stated budget exactly across suggested categories.
- Shows the proposed timeline, vendor questions, ideas, open questions, and assumptions.
- Stores separate wedding, birthday, and community drafts on the current browser; exports a portable text copy.
- Uses local fonts, responsive Next.js images, reduced-motion preferences, keyboard navigation, and a lazy-loaded Three.js sculpture with an SVG fallback.
- Labels suggestions as planning targets, not quotes, bookings, or verified local facts.

## Server and planning logic

- `frontend/app/api/generate/route.ts`: framework route that delegates to the backend handler.
- `backend/api/generate.ts`, `backend/lib/generation-endpoint.ts`: request validation, body-size limits, generic errors and the process-local request limit.
- `backend/lib/planner.ts`, `backend/lib/schedule.ts`: event brief/proposal schemas, exact budget allocation and scheduling rules.
- `backend/lib/plan-store.ts`, `backend/lib/plan-revisions.ts`, `backend/lib/plan-storage.ts`: reusable plan records, revision rules and storage adapters.
- `backend/tests/`: domain and mocked endpoint/provider tests.

Generated planning text remains unverified. Historical model evaluation found semantic failures; schema validity does not prove affordability, availability, dietary safety or compliance with host requirements. Production rate-limit enforcement across instances, provider quotas and timeout behavior remain unverified. The in-memory limiter does not coordinate across server instances.

## Checks

```bash
npm test
npm run lint
npx next typegen frontend
npx tsc --project frontend/tsconfig.json --noEmit --incremental false
npm run build
npm audit --omit=dev
node backend/scripts/report-full-audit.mjs
```

CI retains the domain/endpoint tests, lint, type-check, production build and dependency audit gates. Browser journey coverage is not currently included. The full audit tracks the known development-only `braces` advisory using `backend/scripts/report-full-audit.mjs`.

## License

No license is currently provided. Ask the repository owner before reusing or redistributing this project.
