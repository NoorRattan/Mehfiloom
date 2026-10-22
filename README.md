# Mehfiloom

**Weave your perfect celebration.**

Mehfiloom is a celebration and event planning assistant for weddings, birthdays, and community gatherings. It turns a host's brief into an editable planning draft with a budget allocation, timeline, vendor questions, personalized ideas, and visible assumptions.

[Open the hosted app](https://mehfiloom.vercel.app/). Production deployments on Vercel follow the `main` branch.

## What it does

- Starts from event-specific examples or a Groq-generated draft.
- Tracks event needs, budgets, tasks, vendors, quotes, costs, and payments in one planning canvas.
- Supports functions or sessions, local times in an explicit time zone, task dependencies, and per-session attendance and costs.
- Keeps plans in the current browser's local storage and supports JSON backup and restore.
- Prints a planning document for review.

Examples use fictional content. Suggested allocations, task dates, and vendor questions are planning aids; they are not quotes, bookings, or confirmations.

## Run locally

Use Node.js 22.6 or later and npm.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Example plans work without a provider key. To enable live generation, copy `.env.example` to `.env.local` and add a server-side `GROQ_API_KEY`. Keep the key out of source control and client-side variables. Live requests use Groq's `openai/gpt-oss-120b` model with structured output followed by local schema validation.

## Privacy and generated content

Plans stay in local storage on the device where they were created; there is no account or cross-device sync. When live generation is enabled, the event brief is sent to Groq. A revision also sends accepted earlier revision requests so stated preferences and exclusions can carry forward. Use fictional details; do not enter real guest names or sensitive personal information. See Groq's [data policy](https://console.groq.com/docs/your-data).

Generated content is untrusted planning text. It can contradict requirements or be wrong even when its structure is valid. Hosts must review each suggestion and confirm prices, affordability, capacity, permissions, availability, local rules, dietary ingredients, and allergy cross-contact controls with the relevant providers. The app does not verify these facts.

## Verification

The repository includes unit and endpoint tests, Playwright browser checks, TypeScript, lint, a production build, and dependency audit gates in GitHub Actions. At the 2026-10-23 local verification checkpoint, 87 unit tests and 13 browser tests passed; lint, type-check, production build, and the production dependency audit passed. The browser suite includes keyboard focus after financial edits, revision review, persistence, import/export, and mocked provider failure. `npm audit --omit=dev` reported no production vulnerabilities.

The full dependency audit still reports five development dependency paths to the unpatched [`braces` advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The audit report script tracks this known advisory and fails on newly reported findings. See [the performance baseline](docs/performance-baseline.md) for one-run Lighthouse lab results and their limitations.

### Evaluation evidence

| Parameter | Evidence in this prototype |
| --- | --- |
| Code Quality | TypeScript, shared domain logic, Zod validation, and focused brief, timeline, budget, revision and file-action components. |
| Security | Server-only provider access, bounded JSON requests, generic errors, no-store responses, security headers and a process-local request limit. Production enforcement remains unverified. |
| Efficiency | Exact minor-unit budget calculations and a documented local production Lighthouse baseline; no field-performance claim. |
| Testing | Domain and mocked endpoint tests, isolated Playwright journeys, and CI gates for lint, types, build and dependency audits. |
| Accessibility | Labeled controls, focus management, keyboard journeys and narrow reflow checks; full manual assistive-technology verification remains open. |
| Problem Statement Alignment | Weddings, birthdays and community events with budgets, timelines, vendor checklists and personalized draft ideas, plus revision review and local backup. Generated content requires host review. |

## Known limitations before release

- A bounded live comparison used 18 fictional cases and 36 requests across two prompt variants. Only 9 outputs per variant passed schema validation. Manual review found 0 of 9 current-prompt outputs and 1 of 9 neutral-prompt outputs semantically acceptable under the fixture checks. Failures included hard constraints, affordability claims, allergy safety, and inferred preferences. This was not a user study. Do not treat structured output or the scores as evidence of reliable real-world planning.
- Do not run another live model evaluation without an explicitly authorized request ceiling and spend limit. Use fresh holdout cases for future prompt evaluation.
- The app's in-memory generation limit is process-local and does not coordinate across server instances. Vercel Firewall configuration and enforcement, deployment-environment scope, provider quotas, and slow-provider timeout behavior have not been independently verified end to end.
- Automated browser checks cover core flows, a keyboard-only brief and revision journey, export, and narrow reflow. A full manual keyboard session, screen-reader testing, actual browser zoom at 200%, and host feedback remain outstanding.
- Print output has been rendered and reviewed for Letter and A4, but native browser print-preview behavior has not been confirmed on a range of browsers and printers.
- No live vendor-price, calendar-reminder, shared-account, or cross-device sync integrations are included.

## Useful commands

```bash
npm run lint
npm test
npm run test:e2e
npx tsc --noEmit --incremental false
npm run build
npm audit --omit=dev
```

The browser tests use Playwright Chromium. Install the browser if needed with `npx playwright install chromium`.

## License

No license is currently provided. Ask the repository owner before reusing or redistributing this project.
