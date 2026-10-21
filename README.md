# Mehfiloom

**Weave your perfect celebration.**

The selected vertical is **Celebration & Event Planner**. Mehfiloom is a planning assistant for weddings, birthdays, and community events. It turns a host's brief into a reviewable starting plan with a budget allocation, timeline, vendor questions, personalized ideas, and visible assumptions.

## Current build

The local-first plan core and three event-specific examples are implemented. Wedding, birthday, and community examples have different tasks, suggested lead times, vendor questions, and ideas; they include access checks and leave cultural or tradition-specific preferences to the host. Hosts can optionally divide any event into named sessions, keep expected and confirmed counts separate for each session, assign tasks and costs to one session or the whole event, and forecast per-person costs against only the applicable attendance. Session counts may overlap and are never summed into the unique event count. Event and function start times are local wall times in an explicit IANA time zone; repeated fall-back times require an earlier/later choice, while nonexistent spring-forward times are rejected. Tasks can keep a fixed due date, follow a calendar-day offset from the event or assigned function, or retain both with a visible mismatch warning. Committed costs can hold a dated payment history with notes; the paid total is checked against that history, and deposits do not inflate the cost forecast. Older saved plans migrate their existing paid total to a clearly undated legacy payment. The selected event type controls the example/new-plan flow and adds type-specific guidance to live Groq requests. Suggested timing is a starting point, not a deadline or guarantee. The labeled example plans use synthetic content and make no AI request.

The live model flow needs a Groq API key. Without one, the app keeps the brief and current plan intact and explains how to connect the provider. The adapter uses Groq's `openai/gpt-oss-120b` model with strict JSON Schema output, then validates the returned proposal again with Zod. The live provider response and full browser journeys for all three event types and the revision flow have not yet been verified.

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

Live generation sends the event brief and any revision request to Groq. Groq says inference data is not retained by default, but may be temporarily logged for up to 30 days for reliability or abuse monitoring. Use fictional demo details and avoid real guest names or sensitive personal information. Check Groq's [data policy](https://console.groq.com/docs/your-data), [model limits](https://console.groq.com/docs/rate-limits), and [billing information](https://console.groq.com/docs/billing-faqs) before use.

## What the app currently does

- Captures event type, name, place, optional event date, IANA time zone and local start time, function dates and local start times, attendance, currency, budget cap, style, and must-haves.
- Sends a bounded brief to one server-side Groq request using strict JSON Schema output.
- Validates the response at runtime and rejects duplicate budget categories.
- Treats model budget weights as relative priorities. Server-side integer arithmetic allocates the host's cap exactly across the suggested categories; allocations are planning targets, not quotes or verified local prices.
- Renders the idea, editable concept and tasks, task prerequisites with completion blocking, fixed and relative task-date warnings, budget picture, vendor due-diligence checklist, personalized ideas, and open questions.
- Saves up to 12 plans in this browser, including task status, fixed due dates and relative calendar-day offsets, vendor notes, count-only event and session attendance, preferences, session-scoped tasks, cost records, and payment history. Plans can be exported and imported as validated version-5 JSON; version-1 through version-4 local plans and files are upgraded when read. Plans are not synced to another device.
- Rejects malformed, oversized, unsupported-schema, wrong-currency, and broken-reference imports before applying them. The private print view includes the event brief, budget, timeline, cost register, ideas, vendor checklist, and open questions.
- For AI plans, drafts requested changes separately and shows a review summary before applying them. Accepting preserves recorded host work and creates a reversible revision; stale candidates are rejected, and restoring is available until a later edit.
- Tracks fixed/per-guest costs, estimate ranges, dated payment history, source-named discounts, fees, taxes, and reserve. Adjustment amounts use exact minor-unit arithmetic in the order base minus discounts plus fees plus taxes; included charges are not counted twice, per-guest lines use the applicable attendance and minimum, and unknown mandatory charge reviews remain visible. The app does not infer percentages or statutory tax rules.
- Preserves the brief and current draft when the provider is unconfigured or a request fails.

The request route limits the body to 16 KiB, caps model completion at 3,000 tokens, allows four generation attempts per client key within 20 minutes per running process, and does not retry a failed provider call. Ten focused handler tests cover body limits, malformed and invalid input, missing provider configuration, safe generic failures, output invariants, and rate-window behavior. The in-memory limit is best-effort only: it resets with the process, does not coordinate across instances, and depends on trusted proxy headers. Configure hosting-level quotas and rate limits before public deployment.


Dependency audit note: `npm audit` currently reports five high-severity entries in the development-only Next ESLint dependency chain ending at `braces@3.0.3`. The upstream advisory has no patched release listed; the lockfile remains unchanged because npm’s suggested config downgrade crosses from Next 16 to 14. `npm audit --omit=dev` reports zero production vulnerabilities. Recheck the full audit after an upstream patch.
When live generation is enabled, the event brief and any revision request are sent to Groq. Plans stay in the current browser's local storage; there is no central database or cross-device sync. Avoid entering real guest names or sensitive details.

## Current limits

Live provider output, full end-to-end event journeys, confirmed vendor quotes, regional price sources, date-aware calendar reminders, shared accounts, and a deployed app remain unverified or unimplemented. T-004 passes its local date/function/time-zone criteria; the tested zones and browser scope are recorded in the sibling evidence pack. T-005 passes its scoped dependency and deadline checks, including keyboard prerequisite selection, cycle prevention, blocked completion, and rendered overdue/order/post-event warnings. T-006 passes its scoped synthetic cases: vendor listing hours remain separate from event-date availability, structured proposals cannot set vendor status, and generated plan creation/revision keeps availability unknown. No live provider output is represented. The full keyboard-only intake, revision, save, and export journey remains open under T-018. Session-specific attendance and cost math have focused module tests, including a revision that changes one session while preserving another session's count and fixed costs; the broader protected-constraint/infeasibility matrix and direct review/discard/restore browser testing remain open. Unknown costs and assumptions should be confirmed by the host. Examples are synthetic and are not evidence of market pricing or vendor availability. Automated checks pass, but T-001, T-008, T-009, T-010, T-011, T-015, T-016, T-017, T-018, and T-019 remain partial. API handler limits and generic errors have focused tests; deployment/proxy enforcement, real provider failure behavior, keyboard and screen-reader journeys, rendered contrast, and mobile reflow still need verification.

Planning notes and the evidence pack live outside this repository in the sibling `Mehfiloom-project-files` directory. They document the contest parameters and the remaining milestones; they are not application runtime dependencies.

## Verification and source snapshot — 21 October 2026

The T-012 update to M-002 passed `npm test` (68/68), `npm run lint`, `npm run build`, `npx tsc --noEmit`, and `git diff --check`. Local-browser checks confirmed sourced cost adjustments survive reload, three local plans and the selected plan survive reload, a quota failure remains visibly unsaved through a failed retry, a later retry saves after quota is freed, and a simulated storage-read failure can reload the saved plans without replacing them. Test data used an isolated localhost origin and was cleared after the checks. The T-004 follow-on passed `npm test` (72/72), lint, TypeScript, production build, and `git diff --check`; final-build browser checks verified calendar-day offsets move with the event date while a fixed date remains and is warned on, New York fall-back choices resolve to EDT/EST as selected, and the spring-forward gap is rejected. The T-005 follow-on passed 29/29 plan-store tests and local production-browser checks for keyboard dependency selection, cycle prevention, blocked completion, and visible overdue, prerequisite-order, and post-event warnings. The T-006 follow-on passed `npm test` (75/75), `npx tsc --noEmit`, lint, production build, and `git diff --check`; synthetic adapter, schema, plan-creation, and revision cases keep availability unknown when a listing only reports opening hours. T-020's earlier fresh-clone setup/build/test and source-level module review used baseline commit `a8fcc6bd9ac6ac97999605a8b232dd64c9e9211c` with six uncommitted tracked files overlaid, so that hash alone does not identify the M-002 snapshot. T-021 remains partial: a fresh query using configured local Git authentication found one remote branch (`main`), while an unauthenticated GitHub API read returned 404 and a credential-disabled Git read could not authenticate. Public access remains unverified, and the 10 MB measurement basis is still unclear. The local evidence pack is kept outside this repository in `../Mehfiloom-project-files/`; its [verification plan](../Mehfiloom-project-files/04-verification-and-evaluation.md) and [machine-readable registry](../Mehfiloom-project-files/project-registry.json) links work only in the local sibling-folder layout and are not public evidence URLs. No live provider request, deployment, or submission occurred.

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
