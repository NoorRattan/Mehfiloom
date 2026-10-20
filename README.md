# Mehfiloom

**Weave your perfect celebration.**

Mehfiloom is a planning assistant for weddings, birthdays, and community events. It turns a host's brief into a reviewable starting plan with a budget allocation, timeline, vendor questions, personalized ideas, and visible assumptions.

## Current build

Step 1 is in progress. The app now has an event brief, a structured server-side Gemini generation route, application-side output validation, deterministic budget allocation, and an editable planning canvas. The labeled example plan uses synthetic content and makes no AI request.

The live model flow needs a Gemini API key. Without one, the app keeps the brief and current plan intact and explains how to connect the provider. An API call has not yet been verified with a live credential.

## Run locally

Requirements: Node.js 20.9 or later and npm to run the app. The built-in contract test command uses Node.js 22.6 or later for TypeScript type stripping.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The labeled example works without an API key. To enable live generation at no token cost within Google's available free-tier limits, copy `.env.example` to `.env.local`, then add a key from Google AI Studio:

```dotenv
GEMINI_API_KEY=your_private_key
```

On PowerShell, copy the file with `Copy-Item .env.example .env.local`. Keep the real key only in `.env.local` or the hosting provider's private environment settings. Never use a `NEXT_PUBLIC_` prefix for it, and never commit it. The prototype pins the model to `gemini-3.8-flash` to keep the free-service choice clear.

Google's current Gemini Developer API pricing page lists `gemini-3.8-flash` input and output as free of charge on the Free tier, and says Free-tier content is used to improve Google products. Keep the AI Studio project on its Free tier and do not enable billing if zero-cost use is required. Provider limits depend on the account/project and can change. Live generation sends the event brief to Google; use fictional demo details and do not enter real guest names or sensitive personal information. Check the [current pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) before use.

## What the first milestone does

- Captures event type, name, place, optional date, attendance, currency, budget cap, style, and must-haves.
- Sends a bounded brief to one server-side Gemini request using schema-constrained JSON output.
- Validates the response at runtime and rejects duplicate budget categories.
- Treats model budget weights as relative priorities. Server-side integer arithmetic allocates the host's cap exactly across the suggested categories; allocations are planning targets, not quotes or verified local prices.
- Renders the idea, editable concept and tasks, budget picture, vendor due-diligence checklist, personalized ideas, and open questions.
- Preserves the brief and current draft when the provider is unconfigured or a request fails.

The request route limits the body to 16 KiB, caps model output at 1,800 tokens, allows four generation attempts per client key within 20 minutes per running process, and does not retry a failed provider call. The in-memory limit is best-effort only: it resets with the process, does not coordinate across instances, and depends on trusted proxy headers. Configure hosting-level quotas and rate limits before public deployment.

When live generation is enabled, the event brief is sent to Google Gemini. The app does not currently save a plan to a database or browser storage; generated and locally edited plans exist only in the current page session. Avoid entering private or sensitive details.

## Current limits

Local persistence, import/export, confirmed vendor quotes, regional price sources, date-aware calendar reminders, plan revisions, shared accounts, and a deployed app are not implemented yet. Unknown costs and assumptions should be confirmed by the host. The example is synthetic and is not evidence of market pricing or vendor availability.

Planning notes and the evidence pack live outside this repository in the sibling `Mehfiloom-project-files` directory. They document the contest parameters and the remaining milestones; they are not application runtime dependencies.

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
- [Google GenAI JavaScript SDK](https://ai.google.dev/gemini-api/docs/libraries)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini text generation and output limits](https://ai.google.dev/gemini-api/docs/text-generation)
