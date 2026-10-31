# Architecture and invariants

Mehfiloom has a browser workspace, a server-side generation boundary and a framework-independent planning domain. Public facade modules retain their exports so a domain refactor does not force unrelated callers to change.

## Frontend

`Organizer` composes checklist, budget and vendor panels. `use-organizer` owns organizer actions and user feedback; `organizer-model` derives the displayed checklist and budget. `use-plan-generation` owns request admission, cancellation, timeout, revision context and conflict-safe result application. Its discriminated feedback state keeps pending, error and successful states mutually consistent.

`workspace-store` subscribes to browser storage and tab-local changes. Draft validation permits unfinished input; strict event-brief validation runs before generation. This distinction prevents an invalid intermediate keystroke from replacing the entire draft. Generated allocations receive their own validation, so damaged model output can be discarded while retaining host work. Capacity rejection preserves the previous state, and unavailable browser storage is visible to the host.

`generation-client` validates the HTTP response before a result enters the workspace. Export formatting is a pure operation in `plan-export`; download creation and cleanup belong to the organizer action. Client modules cannot import the provider SDK or Node capabilities; ESLint enforces that boundary.

Global CSS is composed in one ordered entry point. Foundation, shared site, celebration, workspace, responsive and motion styles have separate files under `frontend/styles/`. Keep their import order: responsive refinements intentionally follow base rules. Visual changes require production-browser verification because development and production CSS chunking can differ.

## Generation server

| Module                 | Responsibility                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `generation-endpoint`  | Orchestrate admission, validated brief, provider call and exact result construction |
| `generation-admission` | Bounded per-process request allowance                                               |
| `generation-http`      | Bounded UTF-8 uploads, cancellation, private errors and no-store responses          |
| `groq`                 | Fixed provider configuration, planning guidance and strict response validation      |
| `groq-schema`          | Adapt the proposal contract to the provider's strict JSON-schema requirements       |

The provider receives no execution, browsing or booking tools. Host and vendor text is preference data. An aborted request cannot become a successful result even if an injected provider ignores its abort signal. A consumed or locked upload is a client request error. Provider exceptions never return their raw messages or briefs to the host.

## Planning domain

`planner` exposes brief/proposal contracts and result construction. Money conversion and supported currencies live in `planner-money`; starter/example content lives in `planner-templates`. `planning-limits` is the shared source of request, revision, task, draft and monetary bounds.

`plan-store` coordinates saved-plan operations and relational validation. Focused modules own cost evidence and forecasts (`plan-costs`), task dependencies and dates (`plan-tasks`), reusable record primitives (`plan-record-primitives`) and accepted plan content (`plan-content`). `plan-revisions` applies and restores revisions; `plan-revision-diff` describes the reviewable changes.

The live interface uses `workspace-store`. The richer saved-plan adapters are independent domain modules, not a second hidden browser persistence mechanism.

The following properties must remain true:

- Monetary values use safe integer minor units. Allocation lines reconcile exactly to the accepted cap; estimates, commitments and payments remain distinct.
- Operational vendor availability is never inferred from generated text or opening hours.
- Every task/session/vendor reference belongs to its plan. Copying or importing a plan re-identifies references inside the proposal and undo snapshot as well as editable records.
- Task dependencies are acyclic; completion respects prerequisites.
- Revisions retain host work and cannot overwrite a newer accepted revision. Undo snapshots receive the same relational validation as current content.
- Local calendar times require a named time zone and explicit resolution of repeated times. Historical offsets retain second precision.

## Verification

`npm run test:coverage` tests business behavior and enforces measured coverage thresholds. Frontend coverage includes every component and library, including the decorative renderer; no source files are excluded to raise the score. Native Node coverage covers the backend library modules. Coverage reports do not establish semantic correctness or complete visual/accessibility behavior.

`npm run test:browser` uses the production build in Chromium, Firefox and a mobile configuration. It checks all ten public routes, exact saved allocation edits, generation/revision failure recovery, real text downloads, keyboard paths, 320 CSS-pixel generated-plan reflow and cancellation. Provider responses are intercepted locally; the browser-test server has no provider key.

CI also runs formatting, lint, strict types, the production build, secret-pattern screening and both full/production dependency audits. No dependency advisory is exempted. See `CONTRIBUTING.md` for commands and `SECURITY.md` for operational limits.
