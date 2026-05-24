import { lstat, mkdir, writeFile } from "node:fs/promises";

import { createDefaultHarnessIgnore } from "./ignore";
import {
  createDefaultHarnessConfig,
  createDefaultHarnessConfigToml,
  type HarnessConfig,
  stringifyHarnessConfig,
} from "./standard";
import { inspectHarnessConfig } from "./validation";
import {
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import type {
  AppliedInitializationAction,
  ApplyHarnessInitializationOptions,
  HarnessInitializationAction,
  HarnessInitializationPlan,
  HarnessInitializationResult,
} from "./types";

type PlanOptions = {
  config?: HarnessConfig;
};

async function exists(path: string): Promise<boolean> {
  return Boolean(await lstat(path).catch(() => undefined));
}

export async function planHarnessInitialization(
  root = process.cwd(),
  options: PlanOptions = {}
): Promise<HarnessInitializationPlan> {
  const inspection = await inspectHarnessConfig(root);
  const paths = resolveHarnessPaths(root);
  const actions: HarnessInitializationAction[] = [];
  const configToml = options.config
    ? stringifyHarnessConfig(options.config)
    : createDefaultHarnessConfigToml();
  const ignoreFile = createDefaultHarnessIgnore();

  if (!inspection.hasHarnessDir) {
    actions.push({
      id: "harness.root.ensure",
      kind: "ensure-dir",
      summary: "Create the .harness root directory.",
      target: paths.harnessDir,
    });
  }

  const config = options.config ?? createDefaultHarnessConfig();

  for (const [resource, definition] of Object.entries(config.resources)) {
    const target = resolveRepoLocalPath(
      paths.root,
      definition.path,
      `Resource "${resource}" path`
    );
    actions.push({
      id: `harness.resource.${resource}.ensure`,
      kind: "ensure-dir",
      summary: `Ensure ${toRepoRelative(paths.root, target)} exists.`,
      target,
    });
  }

  if (!inspection.hasHarnessConfig) {
    actions.push({
      id: "harness.config.write",
      kind: "write-file",
      summary: "Write the versioned .harness/harness.toml manifest.",
      target: paths.configPath,
      content: configToml,
    });
  }

  if (!(await exists(paths.ignorePath))) {
    actions.push({
      id: "harness.ignore.write",
      kind: "write-file",
      summary: "Write the repo-root .harnessIgnore projection ignore file.",
      target: paths.ignorePath,
      content: ignoreFile,
    });
  }

  return {
    root: paths.root,
    actions,
    diagnostics: inspection.diagnostics,
  };
}

export async function applyHarnessInitialization(
  root = process.cwd(),
  options: ApplyHarnessInitializationOptions = {}
): Promise<HarnessInitializationResult> {
  const plan = await planHarnessInitialization(root, {
    config: options.config,
  });
  const dryRun = options.dryRun === true || options.yes !== true;
  const requiresConfirmation = plan.actions.some(
    (action) => action.requiredConfirmation
  );

  if (!dryRun && requiresConfirmation && options.yes !== true) {
    throw new Error(
      "Initialization includes filesystem writes. Re-run with --yes after reviewing the plan."
    );
  }

  const appliedActions: AppliedInitializationAction[] = [];

  for (const action of plan.actions) {
    if (dryRun) {
      appliedActions.push({ ...action, applied: false, skipped: true });
      continue;
    }

    if (action.kind === "ensure-dir") {
      if (!action.target) {
        throw new Error(
          `Initialization action ${action.id} is missing a target.`
        );
      }
      await mkdir(action.target, { recursive: true });
      appliedActions.push({ ...action, applied: true });
      continue;
    }

    if (action.kind === "write-file") {
      if (!(action.target && action.content)) {
        throw new Error(
          `Initialization action ${action.id} is missing content.`
        );
      }
      if (await exists(action.target)) {
        appliedActions.push({
          ...action,
          applied: false,
          skipped: true,
          reason: "file already exists",
        });
        continue;
      }
      await mkdir(resolveHarnessPaths(root).harnessDir, { recursive: true });
      await writeFile(action.target, action.content, "utf8");
      appliedActions.push({ ...action, applied: true });
    }
  }

  return {
    root: plan.root,
    dryRun,
    actions: appliedActions,
    diagnostics: plan.diagnostics,
  };
}
