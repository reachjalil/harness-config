import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { loadHarnessIgnoreMatcher } from "./ignore";
import {
  assertRepoLocalPath,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import {
  type HarnessConfig,
  inferHarnessOverrideDirectory,
  listHarnessProjectionTargets,
  parseHarnessConfigToml,
} from "./standard";
import { validateHarnessConfig } from "./validation";
import type {
  ApplyHarnessActivationOptions,
  HarnessActivationAction,
  HarnessActivationPlan,
  HarnessActivationResult,
  HarnessActivationTargetPlan,
  HarnessDiagnostic,
  HarnessIgnoreMatcher,
  HarnessResourceItemProjectionOptions,
} from "./types";

type DesiredFile = {
  bytes: Buffer;
  sourcePath: string;
  relativePath: string;
  mutable: boolean;
};

type DesiredProjection = Map<string, DesiredFile>;

type CleanupUnmanagedMode = NonNullable<
  ApplyHarnessActivationOptions["cleanupUnmanaged"]
>;

type MutablePolicy = NonNullable<
  ApplyHarnessActivationOptions["mutablePolicy"]
>;

type ExistingEntry = {
  type: "directory" | "file" | "symlink" | "other";
  bytes?: Buffer;
};

async function loadConfig(root: string): Promise<HarnessConfig> {
  const raw = await readFile(resolveHarnessPaths(root).configPath, "utf8");
  return parseHarnessConfigToml(raw);
}

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute)));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

function isImmediateOverridePath(relativeFromItem: string): boolean {
  const firstSegment = relativeFromItem.split(/[\\/]/).find(Boolean);
  return Boolean(firstSegment?.startsWith("."));
}

async function addFileIfIncluded(
  projection: DesiredProjection,
  root: string,
  matcher: HarnessIgnoreMatcher,
  sourcePath: string,
  outputRelativePath: string,
  targetPath: string,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  const sourceRelative = toRepoRelative(root, sourcePath);
  if (matcher.ignores(sourceRelative, { targetPath })) {
    return;
  }

  const bytes = await readFile(sourcePath).catch((error: unknown) => {
    diagnostics.push({
      severity: "warning",
      code: "harness.projection_read_failed",
      message: error instanceof Error ? error.message : String(error),
      path: sourceRelative,
    });
    return undefined;
  });
  if (!bytes) {
    return;
  }

  const mutable = matcher.isMutable(sourceRelative, { targetPath });
  setProjectedFile(
    projection,
    outputRelativePath.split(path.sep).join("/"),
    {
      bytes,
      sourcePath,
      relativePath: outputRelativePath.split(path.sep).join("/"),
      mutable,
    },
    root,
    diagnostics
  );
}

function setProjectedFile(
  projection: DesiredProjection,
  outputRelativePath: string,
  file: DesiredFile,
  root: string,
  diagnostics: HarnessDiagnostic[]
): void {
  const existingFile = projection.get(outputRelativePath);
  if (existingFile) {
    projection.set(outputRelativePath, file);
    return;
  }

  for (const [existingPath, existing] of projection) {
    const conflictsWithDescendant = existingPath.startsWith(
      `${outputRelativePath}/`
    );
    const conflictsWithAncestor = outputRelativePath.startsWith(
      `${existingPath}/`
    );
    if (!(conflictsWithDescendant || conflictsWithAncestor)) {
      continue;
    }

    diagnostics.push({
      severity: "error",
      code: "harness.projection_path_conflict",
      message: `Projection path "${outputRelativePath}" conflicts with "${existingPath}". A resource cannot project a file where another projected file requires a directory.`,
      path: toRepoRelative(root, file.sourcePath),
      recommendation:
        "Rename one side of the conflict or make the override replace the exact same file path.",
    });
    diagnostics.push({
      severity: "error",
      code: "harness.projection_path_conflict",
      message: `Projection path "${existingPath}" conflicts with "${outputRelativePath}".`,
      path: toRepoRelative(root, existing.sourcePath),
      recommendation:
        "Rename one side of the conflict or make the override replace the exact same file path.",
    });
    return;
  }

  projection.set(outputRelativePath, {
    bytes: file.bytes,
    sourcePath: file.sourcePath,
    relativePath: outputRelativePath,
    mutable: file.mutable,
  });
}

async function buildProjection(
  root: string,
  config: HarnessConfig,
  targetPath: string,
  diagnostics: HarnessDiagnostic[]
): Promise<DesiredProjection> {
  const projection: DesiredProjection = new Map();
  const matcher = await loadHarnessIgnoreMatcher(root);
  const overrideDir = inferHarnessOverrideDirectory(targetPath);

  for (const [resource, definition] of Object.entries(config.resources)) {
    const resourceDir = resolveRepoLocalPath(
      root,
      definition.path,
      `Resource "${resource}" path`
    );
    const items = await readdir(resourceDir, { withFileTypes: true }).catch(
      () => []
    );

    for (const item of items) {
      if (!item.isDirectory()) {
        continue;
      }
      const itemDir = path.join(resourceDir, item.name);
      const canonicalFiles = await listFiles(itemDir);
      for (const filePath of canonicalFiles) {
        const relativeFromItem = path.relative(itemDir, filePath);
        if (isImmediateOverridePath(relativeFromItem)) {
          continue;
        }
        await addFileIfIncluded(
          projection,
          root,
          matcher,
          filePath,
          path.join(resource, item.name, relativeFromItem),
          targetPath,
          diagnostics
        );
      }

      if (!overrideDir) {
        continue;
      }
      const overridePath = path.join(itemDir, overrideDir);
      const overrideFiles = await listFiles(overridePath);
      for (const filePath of overrideFiles) {
        await addFileIfIncluded(
          projection,
          root,
          matcher,
          filePath,
          path.join(resource, item.name, path.relative(overridePath, filePath)),
          targetPath,
          diagnostics
        );
      }
    }
  }

  return projection;
}

function resolveProjectionPath(
  root: string,
  inputPath: string,
  label: string
): string {
  return assertRepoLocalPath(
    root,
    path.isAbsolute(inputPath) ? inputPath : path.resolve(root, inputPath),
    label
  );
}

function normalizeTargetPathForProjection(root: string, inputPath: string) {
  const target = resolveProjectionPath(root, inputPath, "Target");
  return `./${toRepoRelative(root, target)}`;
}

async function buildResourceItemProjection(
  options: HarnessResourceItemProjectionOptions
): Promise<DesiredProjection> {
  const root = path.resolve(options.root ?? process.cwd());
  const sourceDir = resolveProjectionPath(root, options.sourceDir, "Resource");
  const targetPath = normalizeTargetPathForProjection(
    root,
    options.targetPath ?? options.targetDir
  );
  const sourceState = await lstat(sourceDir).catch(() => undefined);
  if (!sourceState?.isDirectory() || sourceState.isSymbolicLink()) {
    throw new Error(
      `Harness resource item must be a real directory: ${sourceDir}`
    );
  }

  const diagnostics = options.diagnostics ?? [];
  const matcher = await loadHarnessIgnoreMatcher(root);
  const projection: DesiredProjection = new Map();
  const canonicalFiles = await listFiles(sourceDir);
  for (const filePath of canonicalFiles) {
    const relativeFromItem = path.relative(sourceDir, filePath);
    if (isImmediateOverridePath(relativeFromItem)) {
      continue;
    }
    await addFileIfIncluded(
      projection,
      root,
      matcher,
      filePath,
      relativeFromItem,
      targetPath,
      diagnostics
    );
  }

  const overrideDir = inferHarnessOverrideDirectory(targetPath);
  if (!overrideDir) {
    return projection;
  }

  const overridePath = path.join(sourceDir, overrideDir);
  const overrideFiles = await listFiles(overridePath);
  for (const filePath of overrideFiles) {
    await addFileIfIncluded(
      projection,
      root,
      matcher,
      filePath,
      path.relative(overridePath, filePath),
      targetPath,
      diagnostics
    );
  }

  return projection;
}

async function readExistingTree(
  targetRoot: string
): Promise<Map<string, ExistingEntry>> {
  const targetState = await lstat(targetRoot).catch(() => undefined);
  if (
    !targetState ||
    targetState.isSymbolicLink() ||
    !targetState.isDirectory()
  ) {
    return new Map();
  }
  const existing = new Map<string, ExistingEntry>();
  await readExistingTreeInto(targetRoot, targetRoot, existing);
  return existing;
}

async function readExistingTreeInto(
  root: string,
  current: string,
  existing: Map<string, ExistingEntry>
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true }).catch(
    () => []
  );

  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relativePath = path
      .relative(root, absolute)
      .split(path.sep)
      .join("/");

    if (entry.isDirectory()) {
      existing.set(relativePath, { type: "directory" });
      await readExistingTreeInto(root, absolute, existing);
      continue;
    }

    if (entry.isFile()) {
      existing.set(relativePath, {
        type: "file",
        bytes: await readFile(absolute),
      });
      continue;
    }

    existing.set(relativePath, {
      type: entry.isSymbolicLink() ? "symlink" : "other",
    });
  }
}

function isProjectionAncestor(
  relativePath: string,
  projection: DesiredProjection
): boolean {
  return [...projection.keys()].some((projectedPath) =>
    projectedPath.startsWith(`${relativePath}/`)
  );
}

function projectedItemRoots(projection: DesiredProjection): Set<string> {
  const roots = new Set<string>();
  for (const relativePath of projection.keys()) {
    const segments = relativePath.split("/");
    if (segments.length >= 2) {
      roots.add(`${segments[0]}/${segments[1]}`);
    }
  }
  return roots;
}

function unmanagedEntryRoot(
  relativePath: string,
  managedItemRoots: Set<string>
): string {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return segments[0] ?? relativePath;
  }

  const itemRoot = `${segments[0]}/${segments[1]}`;
  if (managedItemRoots.has(itemRoot)) {
    return segments.length >= 3 ? `${itemRoot}/${segments[2]}` : itemRoot;
  }

  return itemRoot;
}

async function planCopyActions(
  targetRoot: string,
  projection: DesiredProjection,
  cleanupUnmanaged: CleanupUnmanagedMode,
  mutablePolicy: MutablePolicy
): Promise<HarnessActivationAction[]> {
  const targetState = await lstat(targetRoot).catch(() => undefined);
  const existing = await readExistingTree(targetRoot);
  const actions: HarnessActivationAction[] = [];
  const managedItemRoots = projectedItemRoots(projection);

  if (targetState?.isSymbolicLink()) {
    actions.push({
      kind: "remove",
      targetPath: targetRoot,
      reason: "replace symlink with copy projection",
    });
  } else if (targetState && !targetState.isDirectory()) {
    actions.push({
      kind: "remove",
      targetPath: targetRoot,
      reason: "replace existing non-directory with copy projection",
    });
  }

  for (const [relativePath, desired] of projection) {
    const targetPath = path.join(targetRoot, relativePath);
    const current = existing.get(relativePath);
    if (!current) {
      actions.push({
        kind: "create",
        targetPath,
        relativePath,
        sourcePath: desired.sourcePath,
      });
      continue;
    }

    if (desired.mutable) {
      if (mutablePolicy === "force") {
        actions.push({
          kind: "update",
          targetPath,
          relativePath,
          sourcePath: desired.sourcePath,
          reason:
            current.type === "file"
              ? "force-mutable: re-project mutable file from source"
              : `force-mutable: replace existing ${current.type} with mutable projection`,
        });
      } else {
        actions.push({
          kind: "mutable",
          targetPath,
          relativePath,
          sourcePath: desired.sourcePath,
          reason:
            "runtime owns this file; use --force-mutable to re-project from source",
        });
      }
      continue;
    }

    if (
      current.type === "file" &&
      current.bytes &&
      hash(current.bytes) === hash(desired.bytes)
    ) {
      actions.push({
        kind: "keep",
        targetPath,
        relativePath,
        sourcePath: desired.sourcePath,
      });
      continue;
    }

    actions.push({
      kind: "update",
      targetPath,
      relativePath,
      sourcePath: desired.sourcePath,
      reason:
        current.type === "file"
          ? undefined
          : `replace existing ${current.type}`,
    });
  }

  const unmanagedRoots = new Map<string, ExistingEntry>();
  for (const [relativePath, entry] of existing) {
    if (projection.has(relativePath)) {
      continue;
    }
    if (
      entry.type === "directory" &&
      isProjectionAncestor(relativePath, projection)
    ) {
      continue;
    }
    if (
      entry.type === "directory" &&
      !relativePath.includes("/") &&
      [...existing.keys()].some((existingPath) =>
        existingPath.startsWith(`${relativePath}/`)
      )
    ) {
      continue;
    }
    const root = unmanagedEntryRoot(relativePath, managedItemRoots);
    const current = unmanagedRoots.get(root);
    if (!current || current.type !== "directory") {
      unmanagedRoots.set(root, existing.get(root) ?? entry);
    }
  }

  for (const [relativePath, entry] of unmanagedRoots) {
    actions.push({
      kind: cleanupUnmanaged === "remove" ? "remove" : "preserve",
      targetPath: path.join(targetRoot, relativePath),
      relativePath,
      reason:
        cleanupUnmanaged === "remove"
          ? `unmanaged ${entry.type} not present in .harness projection`
          : `unmanaged ${entry.type} kept outside .harness projection`,
    });
  }

  return sortActivationActions(actions);
}

function sortActivationActions(
  actions: HarnessActivationAction[]
): HarnessActivationAction[] {
  const rank: Record<HarnessActivationAction["kind"], number> = {
    create: 0,
    update: 1,
    mutable: 2,
    remove: 3,
    keep: 4,
    preserve: 5,
  };

  return actions.toSorted((left, right) => {
    const rankDifference = rank[left.kind] - rank[right.kind];
    if (rankDifference !== 0) {
      return rankDifference;
    }
    return (left.relativePath ?? "").localeCompare(right.relativePath ?? "");
  });
}

export async function copyHarnessResourceItemProjection(
  options: HarnessResourceItemProjectionOptions
): Promise<void> {
  const root = path.resolve(options.root ?? process.cwd());
  const targetDir = resolveProjectionPath(root, options.targetDir, "Target");
  const projection = await buildResourceItemProjection({
    ...options,
    root,
    targetDir,
  });
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  for (const [relativePath, file] of projection) {
    const targetPath = path.join(targetDir, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.bytes);
  }
}

export async function harnessResourceItemProjectionMatchesTarget(
  options: HarnessResourceItemProjectionOptions
): Promise<boolean> {
  const root = path.resolve(options.root ?? process.cwd());
  const targetDir = resolveProjectionPath(root, options.targetDir, "Target");
  const targetState = await lstat(targetDir).catch(() => undefined);
  if (!targetState?.isDirectory() || targetState.isSymbolicLink()) {
    return false;
  }

  const projection = await buildResourceItemProjection({
    ...options,
    root,
    targetDir,
  });
  const existing = await readExistingTree(targetDir);

  for (const [relativePath, entry] of existing) {
    if (
      entry.type === "directory" &&
      isProjectionAncestor(relativePath, projection)
    ) {
      continue;
    }
    const desired = projection.get(relativePath);
    if (!desired || entry.type !== "file" || !entry.bytes) {
      return false;
    }
    if (hash(entry.bytes) !== hash(desired.bytes)) {
      return false;
    }
  }

  for (const relativePath of projection.keys()) {
    const entry = existing.get(relativePath);
    if (!entry || entry.type !== "file") {
      return false;
    }
  }

  return true;
}

export async function planHarnessActivation(
  root = process.cwd(),
  options: Pick<
    ApplyHarnessActivationOptions,
    "cleanupUnmanaged" | "mutablePolicy"
  > = {}
): Promise<HarnessActivationPlan> {
  const absoluteRoot = path.resolve(root);
  const cleanupUnmanaged = options.cleanupUnmanaged ?? "keep";
  const mutablePolicy = options.mutablePolicy ?? "skip";
  const inspection = await validateHarnessConfig(absoluteRoot);
  const diagnostics = [...inspection.diagnostics];
  const config = await loadConfig(absoluteRoot).catch((error: unknown) => {
    diagnostics.push({
      severity: "error",
      code: "harness.activation_config_unavailable",
      message: error instanceof Error ? error.message : String(error),
      path: toRepoRelative(
        absoluteRoot,
        resolveHarnessPaths(absoluteRoot).configPath
      ),
      recommendation:
        "Run harnessc init --yes or create a valid .harness/harness.toml before activating projections.",
    });
    return undefined;
  });

  if (!config) {
    return {
      root: absoluteRoot,
      idempotent: true,
      targets: [],
      diagnostics,
    };
  }

  const targetPaths = listHarnessProjectionTargets(config);
  const plans: HarnessActivationTargetPlan[] = [];

  for (const targetPath of targetPaths) {
    const targetRoot = assertRepoLocalPath(
      absoluteRoot,
      resolveRepoLocalPath(absoluteRoot, targetPath, `Target "${targetPath}"`),
      `Target "${targetPath}"`
    );
    const targetProjection = await buildProjection(
      absoluteRoot,
      config,
      targetPath,
      diagnostics
    );
    const actions = await planCopyActions(
      targetRoot,
      targetProjection,
      cleanupUnmanaged,
      mutablePolicy
    );

    plans.push({
      path: targetPath,
      override: inferHarnessOverrideDirectory(targetPath) ?? "",
      strategy: "copy",
      actions,
    });
  }

  return {
    root: absoluteRoot,
    idempotent: true,
    targets: plans,
    diagnostics,
  };
}

async function applyCopyProjection(
  targetRoot: string,
  projection: DesiredProjection,
  targetPlan: HarnessActivationTargetPlan
): Promise<void> {
  const removesTargetRoot = targetPlan.actions.some(
    (action) =>
      action.kind === "remove" &&
      !action.relativePath &&
      path.resolve(action.targetPath) === path.resolve(targetRoot)
  );
  if (removesTargetRoot) {
    await rm(targetRoot, { recursive: true, force: true });
  }

  await mkdir(targetRoot, { recursive: true });

  for (const action of targetPlan.actions) {
    if (action.kind !== "remove" || !action.relativePath) {
      continue;
    }
    await rm(action.targetPath, { recursive: true, force: true });
    await pruneEmptyParents(targetRoot, path.dirname(action.targetPath));
  }

  for (const action of targetPlan.actions) {
    if (
      !(action.kind === "create" || action.kind === "update") ||
      !action.relativePath
    ) {
      continue;
    }
    const file = projection.get(action.relativePath);
    if (!file) {
      continue;
    }
    const targetPath = path.join(targetRoot, action.relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const existing = await lstat(targetPath).catch(() => undefined);
    if (existing && !existing.isFile()) {
      await rm(targetPath, { recursive: true, force: true });
    }
    await writeFile(targetPath, file.bytes);
  }
}

async function pruneEmptyParents(
  targetRoot: string,
  start: string
): Promise<void> {
  let current = start;
  while (path.resolve(current).startsWith(path.resolve(targetRoot))) {
    if (path.resolve(current) === path.resolve(targetRoot)) {
      return;
    }
    const entries = await readdir(current).catch(() => undefined);
    if (!entries || entries.length > 0) {
      return;
    }
    await rmdir(current);
    current = path.dirname(current);
  }
}

export async function applyHarnessActivation(
  root = process.cwd(),
  options: ApplyHarnessActivationOptions = {}
): Promise<HarnessActivationResult> {
  const plan = await planHarnessActivation(root, {
    cleanupUnmanaged: options.cleanupUnmanaged,
    mutablePolicy: options.mutablePolicy,
  });
  const dryRun = options.dryRun === true || options.yes !== true;
  const hasErrors = plan.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error"
  );
  const projections = new Map<string, DesiredProjection>();
  const appliedActions: HarnessActivationAction[] = [];

  if (dryRun) {
    return {
      root: plan.root,
      dryRun: true,
      plan,
      appliedActions,
    };
  }

  if (hasErrors) {
    throw new Error(
      "Cannot activate while HarnessConfig validation has errors."
    );
  }

  const config = await loadConfig(plan.root);

  for (const target of plan.targets) {
    const targetRoot = assertRepoLocalPath(
      plan.root,
      resolveRepoLocalPath(plan.root, target.path, `Target "${target.path}"`),
      `Target "${target.path}"`
    );
    const projection =
      projections.get(target.path) ??
      (await buildProjection(plan.root, config, target.path, plan.diagnostics));
    projections.set(target.path, projection);
    await applyCopyProjection(targetRoot, projection, target);
    appliedActions.push(
      ...target.actions.filter(
        (action) =>
          action.kind !== "keep" &&
          action.kind !== "preserve" &&
          action.kind !== "mutable"
      )
    );
  }

  return {
    root: plan.root,
    dryRun: false,
    plan,
    appliedActions,
  };
}
