import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const knownAdvisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const knownPackages = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next",
]);

const onWindows = process.platform === "win32";
const npmCommand = onWindows ? process.env.ComSpec ?? "cmd.exe" : "npm";
const npmArgs = onWindows ? ["/d", "/s", "/c", "npm.cmd audit --json"] : ["audit", "--json"];
const result = spawnSync(npmCommand, npmArgs, {
  encoding: "utf8",
});

if (result.error) {
  console.error(`Full dependency audit could not run: ${result.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("Full dependency audit did not return valid JSON.");
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

if (result.status === 0 && Object.keys(report.vulnerabilities ?? {}).length === 0) {
  console.log("Full dependency audit: no vulnerabilities found.");
  process.exit(0);
}

const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const declaredProductionDependencies = new Set(Object.keys(packageJson.dependencies ?? {}));
const unexpectedPackages = vulnerabilities
  .map(([name]) => name)
  .filter((name) => !knownPackages.has(name) || declaredProductionDependencies.has(name));
const unexpectedSeverity = vulnerabilities.some(([, entry]) => entry.severity !== "high");
const unexpectedAdvisory = vulnerabilities.some(([, entry]) =>
  entry.via.some((item) => typeof item !== "string" && item.url !== knownAdvisory),
);
const knownAdvisoryPresent = vulnerabilities.some(([, entry]) =>
  entry.via.some((item) => typeof item !== "string" && item.url === knownAdvisory),
);
const expectedOnly = result.status === 1
  && vulnerabilities.length > 0
  && knownAdvisoryPresent
  && unexpectedPackages.length === 0
  && !unexpectedSeverity
  && !unexpectedAdvisory;

if (!expectedOnly) {
  console.error("Full dependency audit found an unrecognized issue or could not complete cleanly.");
  for (const [name, entry] of vulnerabilities) {
    console.error(`- ${name}: ${entry.severity}; direct=${entry.isDirect}; via=${entry.via.map((item) => typeof item === "string" ? item : item.url).join(", ")}`);
  }
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

console.warn(`Full dependency audit: known development-only advisory ${knownAdvisory} remains across ${vulnerabilities.length} package paths (${vulnerabilities.map(([name]) => name).join(", ")}).`);
console.warn("The blocking production-only audit runs separately; this report fails if a new package, severity, or advisory appears.");
