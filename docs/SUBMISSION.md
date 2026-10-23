# Project submission guide

## Project

**Mehfiloom — Celebration & Event Planner**

Live demo: https://mehfiloom.vercel.app

Repository: https://github.com/NoorRattan/Mehfiloom

The brief is to create a GenAI assistant for weddings, birthdays and community events with budgets, timelines, vendor checklists and personalized ideas. Mehfiloom implements three separate themed journeys, each with its own organizer and assistant.

## Evidence against the judging parameters

| Parameter         | Implementation                                                                                                                                                                                          | How to assess it                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Code quality      | Strict TypeScript, shared typed workspace behavior, Server Component pages, thin framework API adapter, separated provider/domain/HTTP modules                                                          | Run lint and type checks; inspect `frontend/components/`, `backend/lib/`                          |
| Security          | Server-only key, bounded streamed input, strict schemas, ingress throttling, bounded caches, no-store responses, escaped text, generic provider errors, read-only pinned CI                             | Run endpoint/resource regression tests and audits; read `SECURITY.md`                             |
| Efficiency        | Prerendered experience pages, local fonts, responsive image sizing, lazy desktop WebGL, fallback artwork, bounded provider calls/output/timeout                                                         | Inspect build output and network behavior; do not infer a Lighthouse score                        |
| Testing           | 91 backend tests and 21 DOM frontend tests; CI repeats tests, lint, types, build and audits                                                                                                             | Run `npm run check`; examine test names and latest GitHub Actions run                             |
| Accessibility     | Skip link, semantic headings, labelled controls, focus indicators, native checkboxes/details, announced status/errors, progress semantics, budget table roles, reduced motion, larger planning controls | Nine axe semantic checks plus keyboard/manual review; contrast/layout require real-browser checks |
| Problem alignment | Three event identities; personal AI concept, exact budget allocation, timeline, vendor questions, ideas, editable organizer, isolated drafts and export                                                 | Follow the demo journey below                                                                     |

## Five-minute demonstration

1. **Explore the identities.** Open Wedding, Birthday and Community from the home page. Observe their different composition, palette and copy. Each has separate inspiration, organizer and assistant URLs.
2. **Organize without AI.** In a wedding organizer, enter a fictional name/location and budget. Complete a task, add a custom task and save a vendor note. Create a starter budget, adjust its allocations and demonstrate that an incorrect total cannot be saved.
3. **Generate a personal plan.** Open the matching assistant. Example brief: a 40-person garden wedding in Chandigarh, INR 100,000, relaxed shared meal, step-free arrival, vegetarian food and a quiet area. Request a practical first draft. Show the concept, budget, timeline, ideas, assumptions and vendor questions.
4. **Refine and recover.** Ask for simpler decor while retaining the quiet area. Show that accepted requests accompany the next request. Return to the organizer; completed tasks and notes remain. Export a copy. Network/provider failures retain the current draft and show an error.
5. **Show isolation.** Open Birthday and Community organizers. They retain their own briefs and palettes. Refresh a page to demonstrate browser persistence. AI generation is subject to provider and per-process request limits; avoid repeated demonstrations that exhaust quota.

## Verification record

At the October 23, 2026 local review:

- 91 backend tests and 21 frontend tests passed (112 total).
- Nine axe semantic checks passed across the three organizers, three assistants and three generated budget tables; color-contrast testing is disabled in jsdom because it has no browser layout engine.
- Rendered desktop checks sampled 36 planning labels, notes and section controls across the three themes: minimum measured contrast 4.81:1; no horizontal page overflow at the inspected viewport. This is a sample, not a full-page contrast audit.
- Lint, strict TypeScript and optimized production build passed.
- The production dependency audit reported zero vulnerabilities.
- Reachable Git history screening inspected 222 unique text blobs across 29 pre-readiness commits with no supported credential patterns detected. CI reruns the screen after subsequent commits; this is a heuristic screen, not a guarantee.
- An independent static security review identified an unbounded time-zone formatter cache before request throttling. The implementation now normalizes cache keys, retains at most 64 entries, and rejects throttled requests before parsing. Four new backend regressions cover case variants, eviction, early rejection and malformed-attempt admission. Supporting-file coverage in that review was partial; it is not an exhaustive security certification.

Use the latest CI/deployment results for the submitted revision. Local pass results alone do not prove a later deployment succeeded.

## Vercel warning remediation

The earlier deployment had three warning groups: obsolete `cache-dir` npm configuration (repeated at install/build), ESLint 9 deprecation, and an unreviewed resolver postinstall script. The repository now removes only the obsolete environment variable before Vercel npm commands, uses ESLint 10 with the Next.js-supported peer overrides, and explicitly approves only reviewed `unrs-resolver@1.12.2`. The new deployment log must confirm the resulting warning count.

The separate development dependency advisory remains disclosed in `SECURITY.md`; no warning suppression or incompatible force-downgrade is used to hide it.

## Honest limitations

- There is no account synchronization, shared database, actual vendor search, booking, messaging or payment integration. Vendor entries are planning questions and host-entered notes.
- Plans are browser-local. Export them before clearing browser storage. Shared browser profiles can access the same drafts.
- AI output is a suggestion, not verified pricing, safety guidance or vendor availability. Confirm hard requirements with providers. Older accepted revision text can conflict; the host should review the complete proposal.
- The process-local limiter does not provide a distributed quota. Provider spending caps and deployment abuse controls require operational configuration.
- No Lighthouse score, full WCAG conformance or judge score is claimed without a measured audit.
- Repository source has no general reuse license unless the owner explicitly selects one. Public visibility and open-source licensing are different choices.
