import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const match = require("minimatch");

test("lint plugins retain callable and named minimatch APIs with patched upstream", () => {
  assert.equal(typeof match, "function");
  assert.equal(match.minimatch, match);
  assert.equal(require("minimatch-secure/package.json").version, "11.0.3");
  assert.equal(match("frontend/app/page.tsx", "**/*.{ts,tsx}"), true);
  assert.equal(match("frontend/app/page.css", "**/*.{ts,tsx}"), false);
  assert.equal(match("CustomLabel", "*Label"), true);
  assert.equal(match("Icon", "*Label"), false);
});

test("pattern classes and helper contracts used by import rules still work", () => {
  const matcher = new match.Minimatch("frontend/**/!(*.test).tsx");
  assert.equal(matcher.match("frontend/components/chrome.tsx"), true);
  assert.equal(matcher.match("frontend/tests/chrome.test.tsx"), false);
  assert.equal(match.makeRe("**/*.ts").test("backend/lib/planner.ts"), true);
  assert.deepEqual(["page.tsx", "page.css"].filter(match.filter("*.tsx")), [
    "page.tsx",
  ]);
  assert.deepEqual(match.match(["a.ts", "b.js"], "*.ts"), ["a.ts"]);
  assert.equal(
    match.defaults({ dot: true })(".github/ci.yml", "**/*.yml"),
    true,
  );
});

test("ES module consumers retain named imports", async () => {
  const imported = await import("minimatch");
  assert.equal(
    new imported.Minimatch("**/*.tsx").match("frontend/app/page.tsx"),
    true,
  );
  assert.equal(imported.minimatch("label", "l*"), true);
});

test("import boundary lint still rejects a forbidden internal module", () => {
  const { Linter } = require("eslint");
  const plugin = require("eslint-plugin-import");
  const linter = new Linter();
  const config = {
    plugins: { import: plugin },
    rules: {
      "import/no-internal-modules": [
        "error",
        { forbid: ["some-package/private/**"] },
      ],
    },
  };
  assert.equal(
    linter.verify('import value from "some-package/public";', config).length,
    0,
  );
  const messages = linter.verify(
    'import value from "some-package/private/secret";',
    config,
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, "import/no-internal-modules");
});

test("accessibility lint still checks custom controls matched by glob", () => {
  const { Linter } = require("eslint");
  const plugin = require("eslint-plugin-jsx-a11y");
  const linter = new Linter();
  const config = {
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { a11y: plugin },
    rules: {
      "a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["*Input"] },
      ],
    },
  };
  assert.equal(
    linter.verify("const label = <label>Name<CustomInput /></label>;", config)
      .length,
    0,
  );
  const messages = linter.verify(
    "const label = <label>Name<Other /></label>;",
    config,
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, "a11y/label-has-associated-control");
});
