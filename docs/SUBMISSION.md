# Project submission guide

## Project

**Mehfiloom — Celebration & Event Planner**

Live demo: https://mehfiloom.vercel.app

Repository: https://github.com/NoorRattan/Mehfiloom

The brief is to create a GenAI assistant for weddings, birthdays and community events with budgets, timelines, vendor checklists and personalized ideas. Mehfiloom implements three separate themed journeys, each with its own organizer and assistant.

## Evidence against the judging parameters

| Parameter         | Implementation                                                                                                                                                                          | How to assess it                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Code quality      | Strict TypeScript, shared typed workspace behavior, Server Component pages, thin framework API adapter, separated provider/domain/HTTP modules                                          | Run lint and type checks; inspect `frontend/components/`, `backend/lib/`                          |
| Security          | Server-only key, bounded streamed input, strict schemas, ingress throttling, bounded caches, no-store responses, escaped text, generic provider errors, read-only pinned CI             | Run endpoint/resource regression tests and audits; read `SECURITY.md`                             |
| Efficiency        | Prerendered experience pages, local fonts, responsive image sizing, lazy desktop WebGL, fallback artwork, bounded provider calls/output/timeout                                         | Inspect build output and network behavior; do not infer a Lighthouse score                        |
| Testing           | Backend contract/property checks, frontend DOM regressions and production browser workflows; CI repeats tests, lint, types, build and both audits                                       | Run `npm run check`, then `npm run test:browser`; examine the latest GitHub Actions run           |
| Accessibility     | Keyboard organizer tabs, skip link, labelled controls, focus indicators, native checkboxes/details, announced status/errors, progress and budget semantics, live reduced-motion support | Real-browser axe checks include contrast; browser tests exercise mobile layout and keyboard paths |
| Problem alignment | Three event identities; personal AI concept, exact budget allocation, timeline, vendor questions, ideas, editable organizer, isolated drafts and export                                 | Follow the demo journey below                                                                     |

## Five-minute demonstration

1. **Explore the identities.** Open Wedding, Birthday and Community from the home page. Observe their different composition, palette and copy. Each has separate inspiration, organizer and assistant URLs.
2. **Organize without AI.** In a wedding organizer, enter a fictional name/location and budget. Complete a task, add a custom task and save a vendor note. Create a starter budget, adjust its allocations and demonstrate that an incorrect total cannot be saved.
3. **Generate a personal plan.** Open the matching assistant. Example brief: a 40-person garden wedding in Chandigarh, INR 100,000, relaxed shared meal, step-free arrival, vegetarian food and a quiet area. Request a practical first draft. Show the concept, budget, timeline, ideas, assumptions and vendor questions.
4. **Refine and recover.** Ask for simpler decor while retaining the quiet area. Show that accepted requests accompany the next request. Return to the organizer; completed tasks and notes remain. Export a copy. Network/provider failures retain the current draft and show an error.
5. **Show isolation.** Open Birthday and Community organizers. They retain their own briefs and palettes. Refresh a page to demonstrate browser persistence. AI generation is subject to provider and per-process request limits; avoid repeated demonstrations that exhaust quota.

## Verification record

At the October 31, 2026 final local review:

- 117 backend, 81 frontend and five tooling tests passed (203 total). The tooling tests exercise both legacy/current module APIs and actual import-boundary/accessibility lint violations.
- Backend native V8 coverage measured 96.84% lines, 86.54% branches and 96.24% functions. Frontend V8 coverage measured 93.01% lines, 87.43% branches and 91.20% functions. All frontend components and libraries are included, including the decorative renderer; no source exclusions raise these metrics.
- CI coverage gates require backend 95% lines/functions and 85% branches; frontend 90% lines/statements/functions and 85% branches. Formatting is also blocking.
- The production Chromium desktop and mobile run passed 39 applicable tests. The desktop invocation of a mobile-only test was intentionally skipped. Added cases cover cancellation and generated plans at 320 CSS pixels with maximum-length unbroken headings, tasks and vendor labels. Firefox is configured for Linux CI; use the latest hosted run for its result.
- A clean locked `npm ci`, formatting, lint, strict types, production build and credential-pattern screening passed. Both full and production dependency audits reported zero vulnerabilities after the documented development-only minimatch compatibility update; no audit exception is used.
- Oversized components and domain modules were separated into focused panels, hooks, transport, cost/task/revision helpers and ordered stylesheets. Fixes cover stale budget editors, copied session references, historical timezone offsets, ignored cancellation, malformed uploads and unfinished input. Vendor notes from earlier categories remain visible after AI revisions.

These measurements establish engineering checks, not a predicted judging score.

At the October 29, 2026 quality review:

- 104 backend tests and 52 frontend tests passed (156 total). Backend allocation coverage includes 500 varied combinations of caps and priority weights.
- The production Chromium desktop and Pixel 7 browser run passed 31 tests. One desktop invocation of the mobile-only navigation test was intentionally skipped. All ten public routes passed automated axe checks including color contrast and horizontal-overflow checks.
- Each event journey exercised saved manual allocation edits, successful mocked generation, failed revision recovery, checklist preservation, reload, readable file download and isolation from another event type. No live provider calls were made by these tests.
- Keyboard checks cover the skip link's actual focus continuation and organizer arrow/End navigation. The open mobile menu also receives an axe check and Escape/focus-restoration check.
- Lint, strict frontend/backend/browser-test types, production build, production audit and full development audit passed. Both audits reported zero vulnerabilities; there are no advisory exceptions.
- Firefox desktop is included in Linux CI. The local Windows Firefox binary could not launch because its system runtime configuration was missing, so the local run explicitly selected Chromium and mobile; use the latest CI result for Firefox evidence.
- Improvements include upload deadlines and cancellation, stricter model/currency/session validation, complete export, damaged-result recovery, storage failure/capacity notices, newer-draft protection and live WebGL suspension.

These are measured engineering checks, not a claim of a particular judge score or complete WCAG conformance.

At the October 23, 2026 local review:

- 91 backend tests and 21 frontend tests passed (112 total).
- Nine axe semantic checks passed across the three organizers, three assistants and three generated budget tables; color-contrast testing is disabled in jsdom because it has no browser layout engine.
- Rendered desktop checks sampled 36 planning labels, notes and section controls across the three themes: minimum measured contrast 4.81:1; no horizontal page overflow at the inspected viewport. This is a sample, not a full-page contrast audit.
- Lint, strict TypeScript and optimized production build passed.
- The production dependency audit reported zero vulnerabilities.
- Reachable Git history screening inspected 222 unique text blobs across 29 pre-readiness commits with no supported credential patterns detected. CI reruns the screen after subsequent commits; this is a heuristic screen, not a guarantee.
- An independent static security review identified an unbounded time-zone formatter cache before request throttling. The implementation now normalizes cache keys, retains at most 64 entries, and rejects throttled requests before parsing. Four new backend regressions cover case variants, eviction, early rejection and malformed-attempt admission. Supporting-file coverage in that review was partial; it is not an exhaustive security certification.

Hosted verification of application revision [`bb4f538`](https://github.com/NoorRattan/Mehfiloom/commit/bb4f5388cc435585bb3c22a7f484c6936c875e2b):

- [GitHub CI passed](https://github.com/NoorRattan/Mehfiloom/actions/runs/39966684625).
- [Vercel production deployment](https://vercel.com/noorrattans-projects/mehfiloom/DZzYvyCDwMkx6cQ47MuABB6Lwus4) reached Ready in 41 seconds. Searching its complete 70-line build log for `warn` returned no results.
- All ten public experience URLs returned HTTP 200 with `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.
- A real production Groq request returned HTTP 200 with `Cache-Control: no-store`, nine timeline tasks, five vendor groups and four ideas. Its INR 100,000 budget reconciled: total, allocated amount and category sum were each 10,000,000 minor units.

Use the latest CI/deployment results for later application revisions; these observations are tied to the revision above.

## Vercel warning remediation

The earlier deployment had three warning groups: obsolete `cache-dir` npm configuration (repeated at install/build), ESLint 9 deprecation, and an unreviewed resolver postinstall script. The repository now removes only the obsolete environment variable before Vercel npm commands, uses ESLint 10 with the Next.js-supported peer overrides, and explicitly approves only reviewed `unrs-resolver@1.12.2`. All three warning groups were absent in the verified production build above. The remaining two Deployment Settings recommendations are platform suggestions, not build warnings.

At the October 29 review the full dependency audit also returned zero vulnerabilities. The development-advisory exception was removed; both audits now block CI.

## Honest limitations

- There is no account synchronization, shared database, actual vendor search, booking, messaging or payment integration. Vendor entries are planning questions and host-entered notes.
- Plans are browser-local. Export them before clearing browser storage. Shared browser profiles can access the same drafts.
- AI output is a suggestion, not verified pricing, safety guidance or vendor availability. Confirm hard requirements with providers. Older accepted revision text can conflict; the host should review the complete proposal.
- The process-local limiter does not provide a distributed quota. Provider spending caps and deployment abuse controls require operational configuration.
- No Lighthouse score, full WCAG conformance or judge score is claimed without a measured audit.
- Repository source has no general reuse license unless the owner explicitly selects one. Public visibility and open-source licensing are different choices.
