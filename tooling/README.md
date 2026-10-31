# Development dependency compatibility

The October 30, 2026 advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) covers minimatch versions below 11.0.1. ESLint and its Next/React/accessibility plugins still request older majors.

The root override replaces those requests with the local `@mehfiloom/minimatch-compat` package. It delegates matching to the unmodified, pinned upstream `minimatch@11.0.3`, installed under the alias `minimatch-secure`. It exposes the callable CommonJS shape expected by older plugins and the named ES-module API expected by modern consumers. For `eslint-plugin-import`, its `makeRe` bridge provides only the `.test()` interface that plugin consumes, backed by the upstream matcher; it is not a general RegExp replacement. No matching algorithm is vendored or reimplemented. No advisory is suppressed, and application runtime dependencies are unaffected.

`npm run test:tooling` verifies the contracts used by lint plugins. Full lint, the production build and both npm audits remain blocking. Remove this bridge when all parent packages support a patched compatible release directly; do not remove the tests or disable security/accessibility lint rules to bypass a dependency problem.

Scoped overrides send ESLint, `@eslint/config-array` and `@typescript-eslint/typescript-estree` directly to upstream `11.0.3`. The bridge handles the legacy callable API used by the existing React, import and JSX accessibility plugins. A clean `npm ci` must reproduce this tree before changes are published.
