#!/usr/bin/env node
import { copyFile, lstat, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertBuiltCli,
  assertNoErrorDiagnostics,
  createDogfoodFixture,
  runCliJson,
} from "./harness-check.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedOutputs = [".agents", ".claude", "AGENTS.md", "CLAUDE.md"];

async function copyGeneratedOutput(sourcePath, targetPath) {
  const sourceStat = await lstat(sourcePath);
  if (sourceStat.isDirectory()) {
    const targetStat = await lstat(targetPath).catch(() => undefined);
    if (targetStat?.isSymbolicLink() || targetStat?.isFile()) {
      await rm(targetPath, { force: true, recursive: true });
    }
    await mkdir(targetPath, { recursive: true });
    const entries = await readdir(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
      await copyGeneratedOutput(
        path.join(sourcePath, entry.name),
        path.join(targetPath, entry.name)
      );
    }
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}

await assertBuiltCli();

const fixtureRoot = await createDogfoodFixture({ includeLocalProfile: true });
try {
  const result = runCliJson(
    fixtureRoot,
    ["activate", "--yes", ...process.argv.slice(2)],
    "activate"
  );
  assertNoErrorDiagnostics(result.plan.diagnostics, "activate");

  for (const relativePath of generatedOutputs) {
    await copyGeneratedOutput(
      path.join(fixtureRoot, relativePath),
      path.join(repoRoot, relativePath)
    );
  }

  console.log(
    `Harness activation applied ${result.appliedActions.length} target action(s) and ${result.appliedDirActions.length} dir action(s).`
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
