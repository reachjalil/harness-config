import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packageDirs = ["packages/core", "packages/cli", "packages/harnessc"];
const dryRun = process.argv.includes("--dry-run");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    if (options.allowFailure) {
      return result;
    }

    throw new Error(`${command} ${args.join(" ")} failed.`);
  }

  return result;
}

function readPackage(dir) {
  const path = join(root, dir, "package.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function distTag(version) {
  const prerelease = version.split("-")[1];

  if (!prerelease) {
    return "latest";
  }

  const channel = prerelease.split(".")[0];

  if (channel === "alpha" || channel === "beta") {
    return channel;
  }

  if (channel === "rc") {
    return "next";
  }

  return "next";
}

function packageExists(name, version) {
  const result = run("npm", ["view", `${name}@${version}`, "version"], {
    capture: true,
    allowFailure: true,
  });

  return result.status === 0 && result.stdout.trim() === version;
}

for (const dir of packageDirs) {
  const pkg = readPackage(dir);
  const tag = distTag(pkg.version);

  if (packageExists(pkg.name, pkg.version)) {
    console.log(`${pkg.name}@${pkg.version} already exists on npm; skipping.`);
    continue;
  }

  const args = ["publish", "--access", "public", "--tag", tag];

  if (dryRun) {
    args.push("--dry-run");
  } else {
    args.push("--provenance");
  }

  console.log(`Publishing ${pkg.name}@${pkg.version} with npm tag ${tag}.`);
  run("npm", args, { cwd: join(root, dir) });
}
