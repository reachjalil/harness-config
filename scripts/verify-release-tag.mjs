import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packagePaths = [
  "package.json",
  "packages/core/package.json",
  "packages/cli/package.json",
  "packages/harnessc/package.json",
];

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function currentTag() {
  if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  return execFileSync("git", ["describe", "--exact-match", "--tags", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

const tag = currentTag();
const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);

if (!match) {
  throw new Error(`Release tag ${tag} must match vX.Y.Z or vX.Y.Z-prerelease.`);
}

const version = match[1];
const packages = packagePaths.map((path) => ({ path, json: readJson(path) }));

for (const entry of packages) {
  if (entry.json.version !== version) {
    throw new Error(
      `${entry.path} version ${entry.json.version} does not match ${tag}.`
    );
  }
}

const cli = readJson("packages/cli/package.json");
const harnessc = readJson("packages/harnessc/package.json");

if (cli.dependencies?.["@harnessconfig/core"] !== version) {
  throw new Error(
    `packages/cli/package.json must depend on @harnessconfig/core at ${version}`
  );
}

if (harnessc.dependencies?.["@harnessconfig/cli"] !== version) {
  throw new Error(
    `packages/harnessc/package.json must depend on @harnessconfig/cli at ${version}`
  );
}

console.log(`Verified release tag ${tag} for package version ${version}.`);
