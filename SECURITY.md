# Security

The hosted application is an anonymous event-planning assistant. Plans live in the current browser; there is no shared account database or vendor booking/payment service.

## Reporting

Please use [GitHub private vulnerability reporting](https://github.com/NoorRattan/Mehfiloom/security/advisories/new) when available. If it is unavailable, open an issue asking the maintainer for a private reporting channel, without exploit details, personal information, or credential values. Include affected routes, revision, prerequisites and a minimal reproduction in the subsequent private report.

Do not test denial of service or consume paid provider quota against the public deployment. Reproduce with local instances and mocked provider calls.

## Implemented controls

- `GROQ_API_KEY` stays in the server environment. Environment files, local reports, build outputs and backups are ignored by Git. No `NEXT_PUBLIC_` provider key is used.
- The API checks JSON content type, applies an ingress allowance before body parsing, bounds streamed bodies to 16 KiB and validates briefs and proposals with Zod.
- Time-zone formatter keys are normalized and an LRU bound retains at most 64 native formatters. Request-derived limiter storage is also bounded.
- Provider requests use a fixed model/service client, a 25-second timeout, no retries, a 3,000-token output cap and structured output. Generated text receives schema validation and React text escaping; the model has no booking, browser or execution tools.
- Responses carrying event plans/errors use `Cache-Control: no-store`. Provider failures expose generic messages and log selected diagnostic metadata, never raw provider exception messages or briefs.
- Frame denial, MIME sniffing protection, referrer policy and disabled camera/microphone/geolocation permissions are configured for all routes.
- CI uses read-only repository permissions, immutable action revisions, locked installs, credential-pattern screening, tests, lint, strict type checks, production builds and dependency audits.

## Deployment obligations and limits

The in-memory allowance permits four JSON attempts per effective client per 20 minutes **per process**. It relies on a trusted hosting proxy overwriting forwarding headers. It is an ingress backstop, not a distributed quota or account spending ceiling. A scaled public service requires provider spending caps and deployment-level abuse controls; source review alone cannot establish those settings. Never promise unlimited AI generation.

Browser storage is neither encrypted nor isolated between people sharing a browser profile. Clearing browser data removes drafts; export a copy first. A failed storage write retains the draft in tab memory only. Avoid private guest information. Generating a plan sends the brief and revision requests to Groq; vendor notes and task checkmarks stay in the browser.

AI suggestions are unverified. Schema and arithmetic checks do not establish real prices, vendor availability, dietary safety, accessibility compliance or legal requirements. The host must confirm these with qualified providers.

## Dependency advisory

The production dependency audit is blocking. The full development audit currently reports [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in `braces`, transitively used by Next.js lint tooling. At the October 23, 2026 review no patched `braces` release was published. It is not imported by the deployed planning route. The full-audit gate recognizes only this advisory, severity and five package paths; new advisories fail CI. Do not use `npm audit fix --force` to downgrade Next.js tooling incompatibly.

The repository history screen detects supported Groq/GitHub/OpenAI/AWS/private-key patterns and prints locations only. It does not prove every possible secret is absent; use GitHub/provider secret scanning as well. Any accidentally committed credential must be revoked, even after removing its file.
