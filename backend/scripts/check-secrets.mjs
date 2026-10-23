import { execFileSync, spawnSync } from "node:child_process";

// Read reachable Git blobs, including deleted files. Never print matched values.
// This deterministic screen complements provider/GitHub secret scanning; it is
// not a proof that arbitrary credentials are absent.
const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const patterns = [
  ["Groq credential", /gsk_[A-Za-z0-9]{30,}/],
  [
    "GitHub credential",
    /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/,
  ],
  ["OpenAI credential", /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}/],
  ["AWS access identifier", /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  [
    "Private key",
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
  ],
];

const objects = git(["rev-list", "--objects", "--all"])
  .trim()
  .split("\n")
  .filter(Boolean);
const paths = new Map(
  objects.map((row) => {
    const split = row.indexOf(" ");
    return split < 0
      ? [row, "(commit/tree)"]
      : [row.slice(0, split), row.slice(split + 1)];
  }),
);
for (const row of git(["ls-files", "--stage", "-z"]).split("\0")) {
  const entry = /^\d+ ([0-9a-f]+) \d\t(.+)$/s.exec(row);
  if (entry) paths.set(entry[1], entry[2]);
}
const metadata = spawnSync(
  "git",
  ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  {
    input: [...paths.keys()].join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);
if (metadata.status !== 0)
  throw new Error("Cannot inspect Git objects for public-release screening.");
let blobs = 0;
const candidates = [];
for (const row of metadata.stdout.trim().split("\n")) {
  const [hash, type] = row.split(" ");
  if (type !== "blob") continue;
  const bytes = execFileSync("git", ["cat-file", "blob", hash], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (bytes.includes(0)) continue; // binary image/font data
  blobs += 1;
  const lines = bytes.toString("utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [kind, pattern] of patterns) {
      if (pattern.test(line))
        candidates.push({
          kind,
          path: paths.get(hash),
          line: index + 1,
          object: hash.slice(0, 12),
        });
    }
  });
}
console.log(
  `Screened ${blobs} unique reachable text blobs across ${git(["rev-list", "--all", "--count"]).trim()} commits.`,
);
if (candidates.length) {
  console.error(
    "Credential-shaped candidates require review (values redacted):",
  );
  console.error(JSON.stringify(candidates, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    "No supported credential patterns detected. No secret values were logged.",
  );
}
