# Security

The hosted application is an anonymous event-planning assistant. Plans live in the current browser; there is no shared account database or vendor booking/payment service.

## Reporting

Please use [GitHub private vulnerability reporting](https://github.com/NoorRattan/Mehfiloom/security/advisories/new) when available. If it is unavailable, open an issue asking the maintainer for a private reporting channel, without exploit details, personal information, or credential values. Include affected routes, revision, prerequisites and a minimal reproduction in the subsequent private report.

Do not test denial of service or consume paid provider quota against the public deployment. Reproduce with local instances and mocked provider calls.

## Implemented controls

- `GROQ_API_KEY` stays in the server environment. Environment files, local reports, build outputs and backups are ignored by Git. No `NEXT_PUBLIC_` provider key is used.
- The API checks JSON content type, applies an ingress allowance before body parsing, bounds streamed bodies to 16 KiB and five seconds, rejects malformed UTF-8 and validates briefs and proposals with Zod. Currency codes must be supported ISO currencies, model text must contain useful non-whitespace content, and model session references must belong to the submitted brief.
- Time-zone formatter keys are normalized and an LRU bound retains at most 64 native formatters. Request-derived limiter storage is also bounded.
- Provider requests use a fixed model/service client, a 25-second timeout, no retries, a 3,000-token output cap and structured output. Client cancellation propagates to the provider. Non-final completions are rejected. Generated text receives schema validation and React text escaping; the model has no booking, browser or execution tools.
- Responses carrying event plans/errors use `Cache-Control: no-store`. Provider failures expose generic messages and log selected diagnostic metadata, never raw provider exception messages or briefs.
- Frame denial, MIME sniffing protection, referrer policy and disabled camera/microphone/geolocation permissions are configured for all routes. CSP additionally restricts base URLs and form destinations to the same origin and blocks object embeds and framing. It does not impose a script nonce policy; public pages remain prerendered.
- Browser results receive allocation/category/metadata validation before display or persistence. Damaged generated output can be discarded without erasing valid host work. Late model responses cannot overwrite a newer draft. Imported undo snapshots receive relational validation before restoration.
- CI uses read-only repository permissions, immutable action revisions, locked installs, credential-pattern screening, tests, lint, strict type checks, production builds and dependency audits.

## Deployment obligations and limits

The in-memory allowance permits four JSON attempts per effective client per 20 minutes **per process**. It relies on a trusted hosting proxy overwriting forwarding headers. It is an ingress backstop, not a distributed quota or account spending ceiling. A scaled public service requires provider spending caps and deployment-level abuse controls; source review alone cannot establish those settings. Never promise unlimited AI generation.

Browser storage is neither encrypted nor isolated between people sharing a browser profile. Clearing browser data removes drafts; export a copy first. A failed storage write retains the draft in tab memory only. Avoid private guest information. Generating a plan sends the brief and revision requests to Groq; vendor notes and task checkmarks stay in the browser.

AI suggestions are unverified. Schema and arithmetic checks do not establish real prices, vendor availability, dietary safety, accessibility compliance or legal requirements. The host must confirm these with qualified providers.

## Dependency checks

Both `npm audit --omit=dev` and `npm audit` are blocking CI checks. At the October 29, 2026 review both reported zero vulnerabilities. The earlier development-only advisory exception has been removed. Audit results reflect the registry advisory database at the time of the check; rerun them for later revisions. Do not use `npm audit fix --force` to downgrade Next.js tooling incompatibly.

On October 31 the newly reported `minimatch` development advisory was addressed with patched upstream `11.0.3`. Legacy lint plugins consume a small local API bridge; modern consumers use the upstream package directly. The [bridge documentation](tooling/README.md) describes its limited API and removal criteria. Contract tests and real import/accessibility lint-rule tests verify the compatibility path; audit checks remain unmodified and blocking.

The repository history screen detects supported Groq/GitHub/OpenAI/AWS/private-key patterns and prints locations only. It does not prove every possible secret is absent; use GitHub/provider secret scanning as well. Any accidentally committed credential must be revoked, even after removing its file.
