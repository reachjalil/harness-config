import { lstat, mkdir, writeFile } from "node:fs/promises";

import { createDefaultHarnessIgnore } from "./ignore";
import {
  createDefaultHarnessConfigToml,
  type HarnessConfig,
  stringifyHarnessConfig,
} from "./standard";
import { inspectHarnessConfig } from "./validation";
import { resolveHarnessPaths, toRepoRelative } from "./paths";
import type {
  AppliedTransitionAction,
  ApplyHarnessTransitionOptions,
  HarnessTransitionAction,
  HarnessTransitionPlan,
  HarnessTransitionResult,
} from "./types";

type PlanOptions = {
  config?: HarnessConfig;
};

async function exists(path: string): Promise<boolean> {
  return Boolean(await lstat(path).catch(() => undefined));
}

export async function planHarnessTransition(
  root = process.cwd(),
  options: PlanOptions = {}
): Promise<HarnessTransitionPlan> {
  const inspection = await inspectHarnessConfig(root);
  const paths = resolveHarnessPaths(root);
  const actions: HarnessTransitionAction[] = [];
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

  for (const [id, target] of [
    ["harness.skills.ensure", paths.skillsDir],
    ["harness.rules.ensure", paths.rulesDir],
    ["harness.plugins.ensure", paths.pluginsDir],
  ] as const) {
    actions.push({
      id,
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

  for (const surface of inspection.liveSurfaces.filter(
    (surface) => surface.exists
  )) {
    actions.push({
      id: `surface.${surface.id}.review`,
      kind: "manual-review",
      summary:
        "Leave live harness surfaces in place; move reusable source definitions into .harness only after review.",
      source:
        surface.id === "agents.skills"
          ? paths.agentsSkillsDir
          : surface.id === "claude.skills"
            ? paths.claudeSkillsDir
            : surface.id === "gemini.skills"
              ? paths.geminiSkillsDir
              : paths.cursorSkillsDir,
    });
  }

  return {
    root: paths.root,
    actions,
    diagnostics: inspection.diagnostics,
  };
}

export async function applyHarnessTransition(
  root = process.cwd(),
  options: ApplyHarnessTransitionOptions = {}
): Promise<HarnessTransitionResult> {
  const plan = await planHarnessTransition(root);
  const dryRun = options.dryRun === true || options.yes !== true;
  const requiresConfirmation = plan.actions.some(
    (action) => action.requiredConfirmation
  );

  if (!dryRun && requiresConfirmation && options.yes !== true) {
    throw new Error(
      "Transition includes filesystem moves. Re-run with --yes after reviewing the plan."
    );
  }

  const appliedActions: AppliedTransitionAction[] = [];

  for (const action of plan.actions) {
    if (dryRun) {
      appliedActions.push({ ...action, applied: false, skipped: true });
      continue;
    }

    if (action.kind === "manual-review") {
      appliedActions.push({
        ...action,
        applied: false,
        skipped: true,
        reason: "manual review required",
      });
      continue;
    }

    if (action.kind === "ensure-dir") {
      if (!action.target) {
        throw new Error(`Transition action ${action.id} is missing a target.`);
      }
      await mkdir(action.target, { recursive: true });
      appliedActions.push({ ...action, applied: true });
      continue;
    }

    if (action.kind === "write-file") {
      if (!(action.target && action.content)) {
        throw new Error(`Transition action ${action.id} is missing content.`);
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
