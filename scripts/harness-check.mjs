#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cliPath = path.join(repoRoot, "packages/cli/dist/bin.js");
const copiedDogfoodPaths = [
  ".harness",
  "library",
  ".harnessIgnore",
  ".harnessMutable",
  "AGENTS.md",
  "CLAUDE.md",
];
const localProfilePath = ".harnessProfile";
const currentRootDirOutputs = new Set(["AGENTS.md", "CLAUDE.md"]);
const convergedTargetKinds = new Set(["keep", "mutable"]);
const convergedDirKinds = new Set(["keep"]);

async function exists(absolutePath) {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function assertBuiltCli() {
  if (!(await exists(cliPath))) {
    throw new Error("Built CLI not found. Run `pnpm build` first.");
  }
}

export async function createDogfoodFixture(options = {}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "harness-dogfood-"));
  const pathsToCopy = options.includeLocalProfile
    ? [...copiedDogfoodPaths, localProfilePath]
    : copiedDogfoodPaths;
  for (const relativePath of pathsToCopy) {
    const sourcePath = path.join(repoRoot, relativePath);
    if (await exists(sourcePath)) {
      await cp(sourcePath, path.join(fixtureRoot, relativePath), {
        recursive: true,
      });
    }
  }
  return fixtureRoot;
}

export function runCliJson(root, args, label) {
  const result = spawnSync(
    process.execPath,
    [cliPath, ...args, "--root", root, "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    }
  );
  if (result.error) {
    throw result.error;
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    const details = [result.stdout.trim(), result.stderr.trim()]
      .filter(Boolean)
      .join("\n");
    throw new Error(`${label} did not return JSON.\n${details}`, {
      cause: error,
    });
  }

  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status}.\n${formatDiagnosticsForError(payload)}`
    );
  }

  return payload;
}

export function errorDiagnostics(diagnostics = []) {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

export function assertNoErrorDiagnostics(diagnostics = [], label) {
  const errors = errorDiagnostics(diagnostics);
  if (errors.length > 0) {
    throw new Error(`${label} reported errors.\n${formatDiagnostics(errors)}`);
  }
}

export function changedCurrentRootDirOutputs(plan) {
  return (plan.dir?.actions ?? []).filter(
    (action) =>
      currentRootDirOutputs.has(action.relativePath) && action.kind !== "keep"
  );
}

export function disallowedConvergenceActions(plan) {
  const targetActions = (plan.targets ?? []).flatMap((target) =>
    (target.actions ?? [])
      .filter((action) => !convergedTargetKinds.has(action.kind))
      .map((action) => ({
        kind: action.kind,
        path: `${target.path}/${action.relativePath}`,
      }))
  );
  const dirActions = (plan.dir?.actions ?? [])
    .filter((action) => !convergedDirKinds.has(action.kind))
    .map((action) => ({
      kind: action.kind,
      path: action.relativePath,
    }));

  return [...targetActions, ...dirActions];
}

export function summarizePlan(plan) {
  const counts = new Map();
  for (const target of plan.targets ?? []) {
    for (const action of target.actions ?? []) {
      counts.set(action.kind, (counts.get(action.kind) ?? 0) + 1);
    }
  }
  for (const action of plan.dir?.actions ?? []) {
    counts.set(action.kind, (counts.get(action.kind) ?? 0) + 1);
  }
  return [...counts]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind} ${count}`)
    .join(", ");
}

function formatDiagnosticsForError(payload) {
  const diagnostics = payload?.diagnostics ?? payload?.plan?.diagnostics ?? [];
  return diagnostics.length > 0
    ? formatDiagnostics(diagnostics)
    : "No diagnostics returned.";
}

function formatDiagnostics(diagnostics) {
  return diagnostics
    .map((diagnostic) => {
      const pathDetails = diagnostic.path ? ` ${diagnostic.path}` : "";
      return `${diagnostic.severity} ${diagnostic.code}${pathDetails}: ${diagnostic.message}`;
    })
    .join("\n");
}

function formatActions(actions) {
  return actions
    .map((action) => `${action.kind}: ${action.path ?? action.relativePath}`)
    .join("\n");
}

async function main() {
  await assertBuiltCli();

  const fixtureRoot = await createDogfoodFixture();
  let keepFixture = false;
  try {
    const validation = runCliJson(fixtureRoot, ["validate"], "validate");
    assertNoErrorDiagnostics(validation.diagnostics, "validate");

    const initialDryRun = runCliJson(
      fixtureRoot,
      ["activate"],
      "initial dry-run activate"
    );
    assertNoErrorDiagnostics(
      initialDryRun.plan.diagnostics,
      "initial dry-run activate"
    );

    const changedRootOutputs = changedCurrentRootDirOutputs(initialDryRun.plan);
    if (changedRootOutputs.length > 0) {
      throw new Error(
        `Tracked root instruction outputs are out of date. Run \`pnpm run harness:activate\`.\n${formatActions(changedRootOutputs)}`
      );
    }

    const apply = runCliJson(fixtureRoot, ["activate", "--yes"], "activate");
    assertNoErrorDiagnostics(apply.plan.diagnostics, "activate");

    const convergedDryRun = runCliJson(
      fixtureRoot,
      ["activate"],
      "convergence dry-run activate"
    );
    assertNoErrorDiagnostics(
      convergedDryRun.plan.diagnostics,
      "convergence dry-run activate"
    );

    const disallowedActions = disallowedConvergenceActions(
      convergedDryRun.plan
    );
    if (disallowedActions.length > 0) {
      throw new Error(
        `Projection did not converge to keep/mutable actions.\n${formatActions(disallowedActions)}`
      );
    }

    console.log(
      `Harness dogfood check passed (${summarizePlan(convergedDryRun.plan)}).`
    );
  } catch (error) {
    keepFixture = true;
    console.error(`Dogfood fixture root: ${fixtureRoot}`);
    throw error;
  } finally {
    if (process.env.HARNESS_CHECK_KEEP_TMP === "1" || keepFixture) {
      console.error(`Kept dogfood fixture root: ${fixtureRoot}`);
    } else {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
