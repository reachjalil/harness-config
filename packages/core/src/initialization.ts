import { lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createDefaultHarnessIgnore } from "./ignore";
import {
  createDefaultHarnessConfig,
  createDefaultHarnessConfigToml,
  harnessConfigSchema,
  resourceIdSchema,
  stringifyHarnessConfig,
} from "./standard";
import { inspectHarnessConfig } from "./validation";
import {
  CONVENTIONAL_HARNESS_RESOURCES,
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
  HarnessDiagnostic,
} from "./types";

type PlanOptions = {
  configPath?: string;
  resourcesPath?: string;
  config?: ApplyHarnessInitializationOptions["config"];
  resourceKinds?: string[];
};

async function exists(path: string): Promise<boolean> {
  return Boolean(await lstat(path).catch(() => undefined));
}

async function targetHasEntries(path: string): Promise<boolean> {
  const state = await lstat(path).catch(() => undefined);
  if (!state?.isDirectory() || state.isSymbolicLink()) {
    return false;
  }
  const entries = await readdir(path).catch(() => []);
  return entries.length > 0;
}

export async function planHarnessInitialization(
  root = process.cwd(),
  options: PlanOptions = {}
): Promise<HarnessInitializationPlan> {
  const baseConfig = options.config
    ? harnessConfigSchema.parse(options.config)
    : createDefaultHarnessConfig();
  const config = harnessConfigSchema.parse({
    ...baseConfig,
    resources: {
      ...(baseConfig.resources ?? {}),
      ...(options.resourcesPath ? { path: options.resourcesPath } : {}),
    },
  });
  const inspection = await inspectHarnessConfig(root, {
    config,
    configPath: options.configPath,
  });
  const paths = resolveHarnessPaths(root, {
    config,
    configPath: options.configPath,
  });
  const actions: HarnessInitializationAction[] = [];
  const diagnostics: HarnessDiagnostic[] = [...inspection.diagnostics];
  const configToml =
    options.config || options.resourcesPath
      ? stringifyHarnessConfig(config)
      : createDefaultHarnessConfigToml();
  const ignoreFile = createDefaultHarnessIgnore();

  const resourceKinds =
    options.resourceKinds ??
    (options.config ? [] : [...CONVENTIONAL_HARNESS_RESOURCES]);
  for (const resource of resourceKinds) {
    if (!resourceIdSchema.safeParse(resource).success) {
      diagnostics.push({
        severity: "error",
        code: "harness.init_invalid_resource_kind",
        message: `Invalid resource kind "${resource}".`,
        path: resource,
        recommendation:
          "Use lowercase letters, numbers, underscores, or dashes.",
      });
      continue;
    }
    const target = path.join(paths.resourcesDir, resource);
    actions.push({
      id: `harness.resource.${resource}.ensure`,
      kind: "ensure-dir",
      summary: `Ensure ${toRepoRelative(paths.root, target)} exists.`,
      target,
    });
  }

  for (const targetDefinition of config.targets) {
    const target = resolveRepoLocalPath(
      paths.root,
      targetDefinition.path,
      `Target "${targetDefinition.path}" path`
    );
    if (await targetHasEntries(target)) {
      const targetRelative = toRepoRelative(paths.root, target);
      diagnostics.push({
        severity: "info",
        code: "harness.init_target_existing_entries",
        message: `${targetRelative} already contains files. Init declares targets but does not adopt existing runtime files into configured source roots.`,
        path: targetRelative,
        recommendation: `Move files that should be managed into ${toRepoRelative(
          paths.root,
          paths.resourcesDir
        )} before activation.`,
      });
    }
  }

  if (!inspection.hasHarnessConfig) {
    actions.push({
      id: "harness.config.write",
      kind: "write-file",
      summary: `Write the versioned ${toRepoRelative(
        paths.root,
        paths.configPath
      )} manifest.`,
      target: paths.configPath,
      content: configToml,
    });
  }

  if (!(await exists(paths.ignorePath))) {
    actions.push({
      id: "harness.ignore.write",
      kind: "write-file",
      summary:
        "Write the repository-root .harnessIgnore projection ignore file.",
      target: paths.ignorePath,
      content: ignoreFile,
    });
  }

  return {
    root: paths.root,
    actions,
    diagnostics,
  };
}

export async function applyHarnessInitialization(
  root = process.cwd(),
  options: ApplyHarnessInitializationOptions = {}
): Promise<HarnessInitializationResult> {
  const plan = await planHarnessInitialization(root, {
    config: options.config,
    configPath: options.configPath,
    resourcesPath: options.resourcesPath,
    resourceKinds: options.resourceKinds,
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
      await mkdir(path.dirname(action.target), { recursive: true });
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
