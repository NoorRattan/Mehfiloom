# Mehfiloom

**Weave your perfect celebration.**

The selected vertical is **Celebration & Event Planner**. Mehfiloom is a planning assistant for weddings, birthdays, and community events. It turns a host's brief into a reviewable starting plan with a budget allocation, timeline, vendor questions, personalized ideas, and visible assumptions.

## Current build

The local-first plan core and three event-specific examples are implemented. Wedding, birthday, and community examples have different tasks, suggested lead times, vendor questions, and ideas; they include access checks and leave cultural or tradition-specific preferences to the host. Hosts can optionally divide any event into named sessions, keep expected and confirmed counts separate for each session, assign tasks and costs to one session or the whole event, and forecast per-person costs against only the applicable attendance. Session counts may overlap and are never summed into the unique event count. Event and function start times are local wall times in an explicit IANA time zone; repeated fall-back times require an earlier/later choice, while nonexistent spring-forward times are rejected. Tasks can keep a fixed due date, follow a calendar-day offset from the event or assigned function, or retain both with a visible mismatch warning. Committed costs can hold a dated payment history with notes; the paid total is checked against that history, and deposits do not inflate the cost forecast. Older saved plans migrate their existing paid total to a clearly undated legacy payment. The selected event type controls the example/new-plan flow and adds type-specific guidance to live Groq requests. Suggested timing is a starting point, not a deadline or guarantee. The labeled example plans use synthetic content and make no AI request.

The live model flow needs a Groq API key. Without one, the app keeps the brief and current plan intact and explains how to connect the provider. The adapter uses Groq's `openai/gpt-oss-120b` model with strict JSON Schema output, then validates the returned proposal again with Zod. No live provider response has been verified. A synthetic local browser run covers the revision review, discard, accept, and restore path for one wedding plan; all three live event-type journeys remain unverified.

## Run locally

Requirements: Node.js 20.9 or later and npm to run the app. The built-in contract test command uses Node.js 22.6 or later for TypeScript type stripping.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The labeled example works without an API key. To enable live generation while staying within Groq's no-cost Free plan, copy `.env.example` to `.env.local`, then add a key from the [Groq Console](https://console.groq.com/keys):

```dotenv
GROQ_API_KEY=your_private_key
```

On PowerShell, copy the file with `Copy-Item .env.example .env.local`. Keep the real key only in `.env.local` or the hosting provider's private environment settings. Never use a `NEXT_PUBLIC_` prefix for it, and never commit it. The prototype pins the model to `openai/gpt-oss-120b`; it supports Groq strict JSON Schema output. Keep the account on Groq's Free plan and do not enable the paid Developer plan if you need to avoid token charges. Free-plan limits depend on model/account and may change; inspect the current limits for your account before making live requests.

Live generation sends the event brief to Groq. Revisions also send the current request and earlier accepted revision requests so stated preferences and activity exclusions can carry forward; older request context is trimmed if needed to remain within the API body limit. Groq says inference data is not retained by default, but may be temporarily logged for up to 30 days for reliability or abuse monitoring. Use fictional demo details and avoid real guest names or sensitive personal information. Check Groq's [data policy](https://console.groq.com/docs/your-data), [model limits](https://console.groq.com/docs/rate-limits), and [billing information](https://console.groq.com/docs/billing-faqs) before use.

## Deploy to Vercel

Import this Git repository into Vercel. The project uses the standard Next.js runtime; Vercel detects Next.js and uses its default build settings. Before enabling live generation, configure a Vercel Firewall rate-limit rule for `POST /api/generate`, keyed by source IP, and review the pricing shown in the dashboard. The in-process limit below is only a single-instance backstop. See Vercel's [request-header documentation](https://vercel.com/docs/headers/request-headers) and [WAF rate-limiting guide](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Then add `GROQ_API_KEY` as a private project environment variable to enable live generation. Without it, the example plans and rest of the app remain available, while live generation reports that the provider is not configured.

## What the app currently does

- Captures event type, name, place, optional event date, IANA time zone and local start time, function dates and local start times, attendance, currency, budget cap, style, and must-haves.
- Sends a bounded brief to one server-side Groq request using strict JSON Schema output.
- Validates the response at runtime and rejects duplicate budget categories.
- Treats model budget weights as relative priorities. Server-side integer arithmetic allocates the host's cap exactly across the suggested categories; allocations are planning targets, not quotes or verified local prices.
- Renders the idea, editable concept and tasks, task prerequisites with completion blocking, fixed and relative task-date warnings, budget picture, vendor due-diligence checklist, personalized ideas, and open questions.
- Saves up to 12 plans in this browser, including task status, fixed due dates and relative calendar-day offsets, vendor notes, count-only event and session attendance, preferences, session-scoped tasks, cost records, and payment history. Plans can be exported and imported as validated version-5 JSON; version-1 through version-4 local plans and files are upgraded when read. Plans are not synced to another device.
- Rejects malformed, oversized, unsupported-schema, wrong-currency, and broken-reference imports before applying them. The private print view includes the event brief, budget, timeline, cost register, ideas, vendor checklist, and open questions.
- For AI plans, drafts requested changes separately and shows a review summary before applying them. Accepting preserves recorded host work and creates a reversible revision; earlier accepted requests are sent with later revisions to carry forward explicit preferences and activity exclusions, within the API body limit. Stale candidates are rejected, and restoring is available until a later edit.
- Tracks fixed/per-guest costs, estimate ranges, dated payment history, source-named discounts, fees, taxes, and reserve. Quote records include a source, validity date, exclusions, and minimum billable attendance; expired or missing quote validity and minimums remain visible. Entering an amount on an unpriced line makes it an estimate; amount entry does not upgrade an estimate to a quote. Adjustment amounts use exact minor-unit arithmetic in the order base minus discounts plus fees plus taxes; included charges are not counted twice, per-guest lines use the applicable attendance and minimum, and unknown mandatory charge reviews remain visible. A stale quote remains separately labeled as a quote and is warned about; its displayed forecast still needs host reconfirmation. The app does not infer percentages or statutory tax rules.
- Preserves the brief and current draft when the provider is unconfigured or a request fails.
- Sends standard browser hardening headers, omits the default Next.js powered-by header, and uses larger fee/tax editor text that stacks on narrow screens.

The request route accepts JSON only, limits the body to 16 KiB, caps model completion at 3,000 tokens, allows four generation attempts per client key within 20 minutes per running process, and does not retry a failed provider call. Eleven focused handler tests cover content type, body limits, malformed and invalid input, missing provider configuration, safe generic failures, output invariants, and rate-window behavior. The in-memory limit is best-effort only: it resets with the process and does not coordinate across instances. Configure the Vercel Firewall rule before enabling live generation on the hosted app.


Dependency audit note: `npm audit` currently reports five high-severity entries in the development-only Next ESLint dependency chain ending at `braces@3.0.3`. The upstream advisory has no patched release listed; the lockfile remains unchanged because npm’s suggested config downgrade crosses from Next 16 to 14. `npm audit --omit=dev` reports zero production vulnerabilities. Recheck the full audit after an upstream patch.
When live generation is enabled, the event brief is sent to Groq; revisions also send the current request and earlier accepted revision requests. Plans stay in the current browser's local storage; there is no central database or cross-device sync. Avoid entering real guest names or sensitive details.

## Current limits

T-008 has prompt and request-contract checks that carry dietary/access needs and prior activity opt-outs into revisions. T-009 checks sparse briefs and asks for relevant optional preferences without inferring cultural practices or fabricating sources. Both remain partial because live model adherence and held-out constraint cases were not tested.

Live provider output, full end-to-end event journeys, confirmed vendor quotes, regional price sources, date-aware calendar reminders, shared accounts, and a deployed app remain unverified or unimplemented. T-004 passes its local date/function/time-zone criteria; the tested zones and browser scope are recorded in the sibling evidence pack. T-005 passes its scoped dependency and deadline checks, including keyboard prerequisite selection, cycle prevention, blocked completion, and rendered overdue/order/post-event warnings. T-006 passes its scoped synthetic cases: vendor listing hours remain separate from event-date availability, structured proposals cannot set vendor status, and generated plan creation/revision keeps availability unknown. T-007 passes its scoped synthetic and local-browser cases: quote validity, minimum attendance, exclusions, and unknown fees/taxes remain visible; amount entry leaves an unpriced line as an estimate. An expired quote remains in the forecast with a reconfirmation warning, so the host still needs to confirm it. No live provider output, vendor quote, or external price source is represented. The full keyboard-only intake, revision, save, and export journey remains open under T-018. T-010 now has broader synthetic module checks for overlapping sessions, shared and fixed costs, preserved hard requirements and task links, visible over-cap results, per-guest minimums, and independent session-removal guards. The wider 18-case model feasibility evaluation remains open; a synthetic local browser journey has verified one-session attendance recalculation, manual task-scope preservation, and the visible removal guard when linked work remains. T-011 passes its scoped synthetic local-browser journey: after an edit made the pending proposal stale, Accept was disabled, discard retained the edit, a fresh revision was accepted, and restore recovered the earlier plan. No live Groq request was made. Unknown costs and assumptions should be confirmed by the host. Examples are synthetic and are not evidence of market pricing or vendor availability. Automated checks pass, but T-001, T-008, T-009, T-010, T-015, T-016, T-017, T-018, and T-019 remain partial. API handler limits and generic errors have focused tests; deployment/proxy enforcement, real provider failure behavior, keyboard and screen-reader journeys, rendered contrast, and mobile reflow still need verification.

Planning notes and the evidence pack live outside this repository in the sibling `Mehfiloom-project-files` directory. They document the contest parameters and the remaining milestones; they are not application runtime dependencies.

## Verification and source snapshot — 21 October 2026

The T-012 update to M-002 passed `npm test` (68/68), `npm run lint`, `npm run build`, `npx tsc --noEmit`, and `git diff --check`. Local-browser checks confirmed sourced cost adjustments survive reload, three local plans and the selected plan survive reload, a quota failure remains visibly unsaved through a failed retry, a later retry saves after quota is freed, and a simulated storage-read failure can reload the saved plans without replacing them. Test data used an isolated localhost origin and was cleared after the checks. The T-004 follow-on passed `npm test` (72/72), lint, TypeScript, production build, and `git diff --check`; final-build browser checks verified calendar-day offsets move with the event date while a fixed date remains and is warned on, New York fall-back choices resolve to EDT/EST as selected, and the spring-forward gap is rejected. The T-005 follow-on passed 29/29 plan-store tests and local production-browser checks for keyboard dependency selection, cycle prevention, blocked completion, and visible overdue, prerequisite-order, and post-event warnings. The T-006 follow-on passed `npm test` (75/75), `npx tsc --noEmit`, lint, production build, and `git diff --check`; synthetic adapter, schema, plan-creation, and revision cases keep availability unknown when a listing only reports opening hours. T-020's earlier fresh-clone setup/build/test and source-level module review used baseline commit `a8fcc6bd9ac6ac97999605a8b232dd64c9e9211c` with six uncommitted tracked files overlaid, so that hash alone does not identify the M-002 snapshot. T-021 remains partial: a fresh query using configured local Git authentication found one remote branch (`main`), while an unauthenticated GitHub API read returned 404 and a credential-disabled Git read could not authenticate. Public access remains unverified, and the 10 MB measurement basis is still unclear. The local evidence pack is kept outside this repository in `../Mehfiloom-project-files/`; its [verification plan](../Mehfiloom-project-files/04-verification-and-evaluation.md) and [machine-readable registry](../Mehfiloom-project-files/project-registry.json) links work only in the local sibling-folder layout and are not public evidence URLs. No live provider request, deployment, or submission occurred.

T-007 passed its scoped synthetic and isolated-browser checks: quote validity, minimum billable attendance, exclusions, and unknown fees/taxes remain visible, and entering an amount on an unpriced line leaves it as an estimate. An expired quote is still included in the forecast with a reconfirmation warning; the host must confirm the current price. `npm test` passes 77/77. No real supplier quote or market-price source was used.

T-008 adds request-contract and prompt coverage for dietary/access needs, stated cultural preferences, and accepted activity opt-outs carried into later revisions. T-009 covers sparse briefs and relevant questions without inferred cultural practices or fabricated sources. The current revision context is bounded to stay below the request body limit. `npm test` passes 80/80. T-008 and T-009 remain partial because no live provider output or held-out preference fixture was used to verify model adherence.

T-010 local follow-on strengthens the synthetic revision fixtures: all three templates retain their 120-to-160 guest shock checks; an overlapping-session case verifies scoped/shared/fixed costs, unique attendance, task/session links, hard requirements, budget-review reset, and a visible over-cap result; independent guards protect linked costs, confirmed attendance, and preserved task work when removing a session. A separate case confirms the saved per-guest minimum still controls billed quantity. `npm test` passes 81/81, with TypeScript, lint, production build, and `git diff --check` passing. At that point T-010 remained partial because the wider model feasibility cases and direct session UI journey were not run; the later session UI follow-on below records the browser evidence. No live provider request or user study occurred.

T-011 local follow-on — 21 October 2026: an isolated browser origin used the app's clearly labeled synthetic wedding example and a temporary local generation stub. The run created Version A, staged a revision, edited the event name to Version B, and confirmed the stale warning with Accept disabled. Discard removed the proposal while retaining the Version B brief and Version A plan. A fresh revision based on Version B was accepted, then Restore previous state recovered the earlier Version A plan as revision 2. This verifies the scoped UI contract only; no live Groq request or model-output evaluation occurred. See the sibling evidence pack record M004-LOCAL-004.
T-010 session UI follow-on — 21 October 2026: on an isolated `localhost:3002` origin, a temporary local generation stub returned a synthetic wedding proposal. With 150 unique guests, 80 Welcome guests, 120 Main guests, and synthetic scoped/shared/fixed costs, changing only Welcome attendance to 100 recalculated its per-guest line from ₹40,000 to ₹50,000; Main (₹84,000), shared refreshments (₹15,000), fixed venue hire (₹200,000), unique guests, and the stated hard requirements remained unchanged. The over-cap forecast remained visible. The first acceptance exposed a duplicate-task merge when a candidate dropped the session scope from a manually assigned task. The merge now reuses a uniquely matching preserved task and its stable ID; a regression test and a fresh browser acceptance confirmed one Welcome-scoped task remains. Adding a session now starts with a valid editable name. Removing Welcome while its costs and task work remained displayed the expected preservation guard. The temporary route stub was restored before checks; no Groq request was made. `npm test` passes 82/82, with TypeScript, lint, production build, and `git diff --check` passing. T-010 remains partial because the 18-case model feasibility evaluation is unrun. See sibling evidence record M004-LOCAL-005.

## Useful commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm start
```

## References

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation)
- [Groq TypeScript SDK](https://github.com/groq/groq-typescript)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
- [Groq GPT-OSS 120B model](https://console.groq.com/docs/model/openai/gpt-oss-120b)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq data policy](https://console.groq.com/docs/your-data)

## M-002 adjustment update — 21 October 2026

The M-002 implementation adds source-backed fixed or per-guest discount, fee, and tax amounts; exact forecast recalculation; legacy schema-v3 migration; and payment validation against adjusted commitments. Fee/tax review requires an actual source note and either an included status or a separately sourced amount, including zero. T-012 passes its local storage recovery checks. T-013 now provides validated JSON round-trip and a print view covering the eight principal planning sections. Browser checks confirmed export/import under new local IDs and that malformed JSON leaves the current plan intact; contract tests cover oversized, wrong-currency, unsupported-schema, and broken-reference files. The print-only document and stylesheet were checked, but the native preview could not be captured in this browser environment, so page-break and legibility review remain open. No live provider request, deployment, or submission occurred.

## Pre-deployment code review — 22 October 2026

The latest local verification passes 83/83 tests, lint, TypeScript, production build, and `git diff --check`. A production-mode localhost smoke returned 200 for `/`, confirmed the configured hardening headers and absence of `X-Powered-By`, and returned 415 with `no-store` for a `text/plain` generation request. `npm audit --omit=dev` reports zero vulnerabilities; the full audit still reports five high-severity paths to the unpatched development-only `braces` dependency, so no breaking dependency downgrade was applied.

The generation endpoint now rejects non-JSON bodies before rate limiting or provider use. The frontend has corrected labelled static groups and larger, narrow-screen-stacked fee/tax controls. Live Groq output, the 18-case model evaluation, user sessions, screen-reader and complete keyboard checks, rendered mobile/contrast checks, and print-preview legibility remain unverified. Vercel deployment is intentionally deferred until these other checks are complete; configure the documented Vercel Firewall rule before enabling the Groq key.
