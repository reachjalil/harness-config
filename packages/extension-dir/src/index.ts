import {
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  assertRepoLocalPath,
  formatDiagnostics,
  listHarnessProjectionTargets,
  loadHarnessIgnoreMatcher,
  parseHarnessConfigToml,
  repoLocalPathSchema,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "@harnessconfig/core";
import type {
  HarnessConfig,
  HarnessDiagnostic,
  HarnessExtensionDefinition,
  HarnessIgnoreMatcher,
} from "@harnessconfig/core";

const DIR_EXTENSION_ID = "dir";
const DIR_EXTENSION_CONFIG_VERSION = 1;
const PART_FILE_PATTERN = /^(?<order>[0-9]+)_.+$/;

const dirExtensionConfigSchema = z
  .object({
    version: z.literal(DIR_EXTENSION_CONFIG_VERSION),
    activation: z.enum(["explicit", "auto"]).default("explicit"),
    path: repoLocalPathSchema,
  })
  .catchall(z.unknown());

export type DirExtensionActionKind = "create" | "update" | "keep";

export type DirExtensionAction = {
  kind: DirExtensionActionKind;
  targetPath: string;
  relativePath: string;
  sourcePaths: string[];
  reason?: string;
};

export type DirExtensionPlan = {
  root: string;
  extension: typeof DIR_EXTENSION_ID;
  actions: DirExtensionAction[];
  diagnostics: HarnessDiagnostic[];
};

export type DirExtensionResult = {
  root: string;
  dryRun: boolean;
  plan: DirExtensionPlan;
  appliedActions: DirExtensionAction[];
};

export type PlanDirExtensionOptions = {
  config?: HarnessExtensionDefinition;
  harnessConfig?: HarnessConfig;
};

export type ApplyDirExtensionOptions = PlanDirExtensionOptions & {
  dryRun?: boolean;
  yes?: boolean;
};

type DirExtensionConfig = z.infer<typeof dirExtensionConfigSchema>;

type DirectoryEntry = {
  absolutePath: string;
  name: string;
};

type LocalPart = {
  order: number;
  sourcePath: string;
  bytes: Buffer;
  local: boolean;
};

type LeafOutput = {
  absolutePath: string;
  relativePath: string;
  parts: LocalPart[];
  refSourcePath?: string;
  refTargetRelativePath?: string;
};

type DesiredOutput = {
  bytes: Buffer;
  relativePath: string;
  sourcePaths: string[];
  targetPath: string;
};

type ExistingEntryType = "directory" | "file" | "symlink" | "other";

async function loadHarnessConfig(
  root: string,
  diagnostics: HarnessDiagnostic[]
): Promise<HarnessConfig | undefined> {
  const configPath = resolveHarnessPaths(root).configPath;
  const raw = await readFile(configPath, "utf8").catch((error: unknown) => {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_config_unavailable",
      message: error instanceof Error ? error.message : String(error),
      path: toRepoRelative(root, configPath),
      recommendation:
        "Create a valid .harness/harness.toml before running dir composition.",
    });
    return undefined;
  });
  if (raw === undefined) {
    return undefined;
  }

  try {
    return parseHarnessConfigToml(raw);
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_config_invalid",
      message: error instanceof Error ? error.message : String(error),
      path: toRepoRelative(root, configPath),
      recommendation:
        "Update harness.toml before running extension activation.",
    });
    return undefined;
  }
}

function parseDirExtensionConfig(
  config: HarnessExtensionDefinition | undefined,
  diagnostics: HarnessDiagnostic[]
): DirExtensionConfig | undefined {
  if (!config) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_extension_missing",
      message: "The dir extension is not declared in harness.toml.",
      path: "extensions.dir",
      recommendation:
        'Declare [extensions.dir] with version = 1 and path = "./.harness/dir".',
    });
    return undefined;
  }

  const result = dirExtensionConfigSchema.safeParse(config);
  if (!result.success) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_config_invalid",
      message: result.error.issues.map((issue) => issue.message).join("; "),
      path: "extensions.dir",
      recommendation:
        'Use version = 1, activation = "explicit" or "auto", and a repo-local path.',
    });
    return undefined;
  }

  return result.data;
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    !relative || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function normalizeRelative(input: string): string {
  return input.split(path.sep).join("/");
}

function pathOverlaps(left: string, right: string): boolean {
  return isInsideOrEqual(left, right) || isInsideOrEqual(right, left);
}

function entryTypeFromStat(
  stat: Awaited<ReturnType<typeof lstat>>
): ExistingEntryType | undefined {
  if (stat.isSymbolicLink()) {
    return "symlink";
  }
  if (stat.isDirectory()) {
    return "directory";
  }
  if (stat.isFile()) {
    return "file";
  }
  return "other";
}

function shouldIgnore(
  matcher: HarnessIgnoreMatcher,
  root: string,
  absolutePath: string,
  isDirectory: boolean
): boolean {
  return matcher.ignores(toRepoRelative(root, absolutePath), {
    globalOnly: true,
    isDirectory,
  });
}

async function readDirectoryEntries(
  root: string,
  directory: string,
  diagnostics: HarnessDiagnostic[]
): Promise<DirectoryEntry[] | undefined> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: unknown) => {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_read_failed",
        message: error instanceof Error ? error.message : String(error),
        path: toRepoRelative(root, directory),
      });
      return undefined;
    }
  );

  return entries?.map((entry) => ({
    absolutePath: path.join(directory, entry.name),
    name: entry.name,
  }));
}

async function collectLeafOutputs(
  root: string,
  dirRoot: string,
  matcher: HarnessIgnoreMatcher,
  diagnostics: HarnessDiagnostic[]
): Promise<Map<string, LeafOutput>> {
  const leaves = new Map<string, LeafOutput>();
  const rootState = await lstat(dirRoot).catch(() => undefined);

  if (!rootState) {
    diagnostics.push({
      severity: "warning",
      code: "harness.dir_root_missing",
      message: `${toRepoRelative(root, dirRoot)} does not exist.`,
      path: toRepoRelative(root, dirRoot),
      recommendation:
        "Create the dir extension source root or update its path.",
    });
    return leaves;
  }

  if (!rootState.isDirectory() || rootState.isSymbolicLink()) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_root_not_directory",
      message: `${toRepoRelative(root, dirRoot)} must be a real directory.`,
      path: toRepoRelative(root, dirRoot),
    });
    return leaves;
  }

  async function visit(directory: string, isRoot: boolean): Promise<void> {
    if (!isRoot && shouldIgnore(matcher, root, directory, true)) {
      return;
    }

    const entries = await readDirectoryEntries(root, directory, diagnostics);
    if (!entries) {
      return;
    }

    const childDirectories: DirectoryEntry[] = [];
    const files: DirectoryEntry[] = [];

    for (const entry of entries) {
      const stat = await lstat(entry.absolutePath).catch((error: unknown) => {
        diagnostics.push({
          severity: "error",
          code: "harness.dir_entry_read_failed",
          message: error instanceof Error ? error.message : String(error),
          path: toRepoRelative(root, entry.absolutePath),
        });
        return undefined;
      });
      if (!stat) {
        continue;
      }

      const entryType = entryTypeFromStat(stat);
      if (entryType === "directory") {
        if (!shouldIgnore(matcher, root, entry.absolutePath, true)) {
          childDirectories.push(entry);
        }
        continue;
      }

      if (entryType === "file") {
        if (!shouldIgnore(matcher, root, entry.absolutePath, false)) {
          files.push(entry);
        }
        continue;
      }

      if (!shouldIgnore(matcher, root, entry.absolutePath, false)) {
        diagnostics.push({
          severity: "error",
          code: "harness.dir_invalid_entry",
          message: `Dir extension entries must be regular files or directories, not ${entryType}.`,
          path: toRepoRelative(root, entry.absolutePath),
          recommendation: "Move this entry or exclude it with .harnessIgnore.",
        });
      }
    }

    if (isRoot) {
      for (const file of files) {
        diagnostics.push({
          severity: "error",
          code: "harness.dir_invalid_root_file",
          message:
            "The dir extension root may only contain output path directories.",
          path: toRepoRelative(root, file.absolutePath),
          recommendation: "Move this file into a leaf output directory.",
        });
      }
      await Promise.all(
        childDirectories.map((entry) => visit(entry.absolutePath, false))
      );
      return;
    }

    if (childDirectories.length > 0) {
      for (const file of files) {
        diagnostics.push({
          severity: "error",
          code: "harness.dir_mixed_container",
          message:
            "A dir path container cannot also contain part files or .ref.",
          path: toRepoRelative(root, file.absolutePath),
          recommendation:
            "Move files into a leaf output directory or exclude them with .harnessIgnore.",
        });
      }
      await Promise.all(
        childDirectories.map((entry) => visit(entry.absolutePath, false))
      );
      return;
    }

    const relativePath = normalizeRelative(path.relative(dirRoot, directory));
    if (!relativePath) {
      return;
    }

    const leaf: LeafOutput = {
      absolutePath: directory,
      relativePath,
      parts: [],
    };

    for (const file of files) {
      if (file.name === ".ref") {
        const rawRef = await readFile(file.absolutePath, "utf8").catch(
          (error: unknown) => {
            diagnostics.push({
              severity: "error",
              code: "harness.dir_ref_read_failed",
              message: error instanceof Error ? error.message : String(error),
              path: toRepoRelative(root, file.absolutePath),
            });
            return undefined;
          }
        );
        if (rawRef === undefined) {
          continue;
        }
        const refLines = rawRef
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (refLines.length !== 1) {
          diagnostics.push({
            severity: "error",
            code: "harness.dir_ref_invalid",
            message: ".ref must contain exactly one relative dir output path.",
            path: toRepoRelative(root, file.absolutePath),
          });
          continue;
        }
        const refLine = refLines[0] ?? "";
        if (path.isAbsolute(refLine)) {
          diagnostics.push({
            severity: "error",
            code: "harness.dir_ref_absolute",
            message: ".ref targets must be relative paths.",
            path: toRepoRelative(root, file.absolutePath),
          });
          continue;
        }
        leaf.refSourcePath = file.absolutePath;
        leaf.refTargetRelativePath = normalizeRelative(
          path.relative(dirRoot, path.resolve(directory, refLine))
        );
        continue;
      }

      const partMatch = file.name.match(PART_FILE_PATTERN);
      if (!partMatch?.groups?.order) {
        diagnostics.push({
          severity: "error",
          code: "harness.dir_invalid_part",
          message:
            'Dir extension part files must start with a numeric prefix and underscore, such as "100_intro.md".',
          path: toRepoRelative(root, file.absolutePath),
          recommendation: "Rename this file or exclude it with .harnessIgnore.",
        });
        continue;
      }

      const bytes = await readFile(file.absolutePath).catch(
        (error: unknown) => {
          diagnostics.push({
            severity: "error",
            code: "harness.dir_part_read_failed",
            message: error instanceof Error ? error.message : String(error),
            path: toRepoRelative(root, file.absolutePath),
          });
          return undefined;
        }
      );
      if (!bytes) {
        continue;
      }

      leaf.parts.push({
        order: Number.parseInt(partMatch.groups.order, 10),
        sourcePath: file.absolutePath,
        bytes,
        local: true,
      });
    }

    leaves.set(relativePath, leaf);
  }

  await visit(dirRoot, true);
  return leaves;
}

function resolveRefTargets(
  root: string,
  dirRoot: string,
  leaves: Map<string, LeafOutput>,
  diagnostics: HarnessDiagnostic[]
): void {
  for (const leaf of leaves.values()) {
    const refTarget = leaf.refTargetRelativePath;
    if (!refTarget) {
      continue;
    }

    if (
      refTarget === ".." ||
      refTarget.startsWith("../") ||
      path.isAbsolute(refTarget)
    ) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_ref_outside_root",
        message: ".ref targets must stay inside the dir extension root.",
        path: leaf.refSourcePath
          ? toRepoRelative(root, leaf.refSourcePath)
          : toRepoRelative(root, leaf.absolutePath),
      });
      leaf.refTargetRelativePath = undefined;
      continue;
    }

    const targetPath = path.join(dirRoot, refTarget);
    if (!isInsideOrEqual(dirRoot, targetPath)) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_ref_outside_root",
        message: ".ref targets must stay inside the dir extension root.",
        path: leaf.refSourcePath
          ? toRepoRelative(root, leaf.refSourcePath)
          : toRepoRelative(root, leaf.absolutePath),
      });
      leaf.refTargetRelativePath = undefined;
      continue;
    }

    if (!leaves.has(refTarget)) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_ref_missing",
        message: `.ref target "${refTarget}" does not resolve to an included leaf output.`,
        path: leaf.refSourcePath
          ? toRepoRelative(root, leaf.refSourcePath)
          : toRepoRelative(root, leaf.absolutePath),
        recommendation:
          "Point .ref at another leaf directory or update .harnessIgnore.",
      });
      leaf.refTargetRelativePath = undefined;
    }
  }
}

function expandParts(
  leaf: LeafOutput,
  leaves: Map<string, LeafOutput>,
  diagnostics: HarnessDiagnostic[],
  stack: string[] = []
): LocalPart[] {
  if (stack.includes(leaf.relativePath)) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_ref_cycle",
      message: `Dir extension .ref cycle detected: ${[
        ...stack,
        leaf.relativePath,
      ].join(" -> ")}.`,
      path: leaf.refSourcePath,
      recommendation: "Remove one .ref edge from the cycle.",
    });
    return [];
  }

  const imported = leaf.refTargetRelativePath
    ? expandParts(
        leaves.get(leaf.refTargetRelativePath) ?? leaf,
        leaves,
        diagnostics,
        [...stack, leaf.relativePath]
      ).map((part) => ({ ...part, local: false }))
    : [];

  return [...imported, ...leaf.parts]
    .map((part) => ({ ...part }))
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      if (left.local !== right.local) {
        return left.local ? 1 : -1;
      }
      return normalizeRelative(left.sourcePath).localeCompare(
        normalizeRelative(right.sourcePath)
      );
    });
}

function validateOutputPath(
  root: string,
  config: HarnessConfig,
  relativePath: string,
  diagnostics: HarnessDiagnostic[]
): string | undefined {
  const targetPath = assertRepoLocalPath(
    root,
    path.resolve(root, relativePath),
    `Dir extension output "${relativePath}"`
  );
  const harnessDir = resolveHarnessPaths(root).harnessDir;

  if (isInsideOrEqual(harnessDir, targetPath)) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_output_inside_harness",
      message: `Dir extension output "${relativePath}" cannot write inside .harness.`,
      path: relativePath,
      recommendation: "Choose an output path outside .harness.",
    });
    return undefined;
  }

  for (const target of listHarnessProjectionTargets(config)) {
    const targetRoot = resolveRepoLocalPath(
      root,
      target,
      `Target "${target}" path`
    );
    if (pathOverlaps(targetRoot, targetPath)) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_output_target_overlap",
        message: `Dir extension output "${relativePath}" overlaps declared target "${target}".`,
        path: relativePath,
        recommendation:
          "Keep dir outputs outside core target projection roots.",
      });
      return undefined;
    }
  }

  return targetPath;
}

async function buildDesiredOutputs(
  root: string,
  config: HarnessConfig,
  dirConfig: DirExtensionConfig,
  diagnostics: HarnessDiagnostic[]
): Promise<DesiredOutput[]> {
  const dirRoot = resolveRepoLocalPath(
    root,
    dirConfig.path,
    "Dir extension path"
  );
  const matcher = await loadHarnessIgnoreMatcher(root);
  const leaves = await collectLeafOutputs(root, dirRoot, matcher, diagnostics);
  resolveRefTargets(root, dirRoot, leaves, diagnostics);

  const outputs: DesiredOutput[] = [];
  for (const leaf of leaves.values()) {
    const targetPath = validateOutputPath(
      root,
      config,
      leaf.relativePath,
      diagnostics
    );
    if (!targetPath) {
      continue;
    }

    const parts = expandParts(leaf, leaves, diagnostics);
    const sourcePaths = [
      ...(leaf.refSourcePath ? [leaf.refSourcePath] : []),
      ...parts.map((part) => part.sourcePath),
    ];
    outputs.push({
      bytes: Buffer.concat(parts.map((part) => part.bytes)),
      relativePath: leaf.relativePath,
      sourcePaths,
      targetPath,
    });
  }

  return outputs.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
}

async function planOutputAction(
  output: DesiredOutput
): Promise<DirExtensionAction> {
  const existing = await lstat(output.targetPath).catch(() => undefined);
  const actionBase = {
    relativePath: output.relativePath,
    sourcePaths: output.sourcePaths,
    targetPath: output.targetPath,
  };

  if (!existing) {
    return { ...actionBase, kind: "create" };
  }

  const existingType = entryTypeFromStat(existing);
  if (existingType !== "file") {
    return {
      ...actionBase,
      kind: "update",
      reason: `replace existing ${existingType} with composed file`,
    };
  }

  const current = await readFile(output.targetPath);
  if (current.equals(output.bytes)) {
    return { ...actionBase, kind: "keep" };
  }

  return { ...actionBase, kind: "update" };
}

async function planActions(
  outputs: DesiredOutput[]
): Promise<DirExtensionAction[]> {
  return Promise.all(outputs.map((output) => planOutputAction(output)));
}

async function loadPlanInputs(
  root: string,
  options: PlanDirExtensionOptions,
  diagnostics: HarnessDiagnostic[]
): Promise<
  | {
      harnessConfig: HarnessConfig;
      dirConfig: DirExtensionConfig;
    }
  | undefined
> {
  const harnessConfig =
    options.harnessConfig ?? (await loadHarnessConfig(root, diagnostics));
  if (!harnessConfig) {
    return undefined;
  }

  const rawConfig = options.config ?? harnessConfig.extensions.dir;
  const dirConfig = parseDirExtensionConfig(rawConfig, diagnostics);
  if (!dirConfig) {
    return undefined;
  }

  return { harnessConfig, dirConfig };
}

export async function planDirExtension(
  root = process.cwd(),
  options: PlanDirExtensionOptions = {}
): Promise<DirExtensionPlan> {
  const absoluteRoot = path.resolve(root);
  const diagnostics: HarnessDiagnostic[] = [];
  const inputs = await loadPlanInputs(absoluteRoot, options, diagnostics);
  const outputs = inputs
    ? await buildDesiredOutputs(
        absoluteRoot,
        inputs.harnessConfig,
        inputs.dirConfig,
        diagnostics
      )
    : [];

  return {
    root: absoluteRoot,
    extension: DIR_EXTENSION_ID,
    actions: await planActions(outputs),
    diagnostics,
  };
}

export async function applyDirExtension(
  root = process.cwd(),
  options: ApplyDirExtensionOptions = {}
): Promise<DirExtensionResult> {
  const plan = await planDirExtension(root, options);
  const dryRun = options.dryRun === true || options.yes !== true;
  const appliedActions: DirExtensionAction[] = [];

  if (dryRun) {
    return {
      root: plan.root,
      dryRun: true,
      plan,
      appliedActions,
    };
  }

  if (plan.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new Error("Cannot activate dir extension while it has errors.");
  }

  const diagnostics: HarnessDiagnostic[] = [];
  const inputs = await loadPlanInputs(plan.root, options, diagnostics);
  if (!inputs) {
    throw new Error("Cannot reload dir extension configuration.");
  }
  const outputs = await buildDesiredOutputs(
    plan.root,
    inputs.harnessConfig,
    inputs.dirConfig,
    diagnostics
  );
  const outputByRelativePath = new Map(
    outputs.map((output) => [output.relativePath, output])
  );

  for (const action of plan.actions) {
    if (!(action.kind === "create" || action.kind === "update")) {
      continue;
    }
    const output = outputByRelativePath.get(action.relativePath);
    if (!output) {
      continue;
    }
    const existing = await lstat(output.targetPath).catch(() => undefined);
    if (existing && !existing.isFile()) {
      await rm(output.targetPath, { recursive: true, force: true });
    }
    await mkdir(path.dirname(output.targetPath), { recursive: true });
    await writeFile(output.targetPath, output.bytes);
    appliedActions.push(action);
  }

  return {
    root: plan.root,
    dryRun: false,
    plan,
    appliedActions,
  };
}

function summarizeActions(actions: DirExtensionAction[]): string {
  const counts = { create: 0, update: 0, keep: 0 };
  for (const action of actions) {
    counts[action.kind] += 1;
  }
  return `create ${counts.create}, update ${counts.update}, keep ${counts.keep}`;
}

function formatAction(root: string, action: DirExtensionAction): string {
  const target = toRepoRelative(root, action.targetPath);
  const source =
    action.sourcePaths.length === 0
      ? "empty composition"
      : `${action.sourcePaths.length} source file${
          action.sourcePaths.length === 1 ? "" : "s"
        }`;
  const reason = action.reason ? ` (${action.reason})` : "";
  return `${action.kind}: ${target} <- ${source}${reason}`;
}

export function formatDirExtensionPlan(plan: DirExtensionPlan): string {
  const diagnostics = formatDiagnostics(plan.diagnostics);
  const actions =
    plan.actions.length === 0
      ? "No dir extension outputs."
      : plan.actions
          .map((action) => `  - ${formatAction(plan.root, action)}`)
          .join("\n");

  return `HarnessConfig dir extension plan\n\nDiagnostics:\n${diagnostics}\n\nSummary: ${summarizeActions(
    plan.actions
  )}\n\nActions:\n${actions}`;
}

export function formatDirExtensionResult(result: DirExtensionResult): string {
  const applied =
    result.appliedActions.length === 0
      ? "No file changes applied."
      : result.appliedActions
          .map((action) => formatAction(result.root, action))
          .join("\n");

  return `HarnessConfig dir extension ${
    result.dryRun ? "dry run" : "result"
  }\n\n${formatDirExtensionPlan(result.plan)}\n\nApplied:\n${applied}`;
}

export const dirExtension = {
  id: DIR_EXTENSION_ID,
  compatibleHarnessVersions: [1],
  configVersions: [DIR_EXTENSION_CONFIG_VERSION],
  plan: planDirExtension,
  apply: applyDirExtension,
  formatPlan: formatDirExtensionPlan,
  formatResult: formatDirExtensionResult,
} as const;
