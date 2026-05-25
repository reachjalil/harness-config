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

import { type DirOutput, planHarnessDir } from "./dir";
import { loadHarnessIgnoreMatcherDetailed } from "./ignore";
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
  HarnessActivationDirAction,
  HarnessActivationDirPlan,
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
  targetOutputPath: string,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  const sourceRelative = toRepoRelative(root, sourcePath);
  if (
    matcher.ignores(sourceRelative, {
      outputPath: targetOutputPath,
      targetPath,
    })
  ) {
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

  const mutable = matcher.isMutable(sourceRelative, {
    outputPath: targetOutputPath,
    targetPath,
  });
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

function repoRelativeOutputPath(
  targetRoot: string,
  outputRelativePath: string
): string {
  return normalizeTargetPathString(
    path.posix.join(targetRoot, outputRelativePath)
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
  const { matcher, diagnostics: ignoreDiagnostics } =
    await loadHarnessIgnoreMatcherDetailed(root, { config });
  diagnostics.push(...ignoreDiagnostics);
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
          repoRelativeOutputPath(
            targetPath,
            path.posix.join(
              resource,
              item.name,
              normalizeTargetPathString(relativeFromItem)
            )
          ),
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
          repoRelativeOutputPath(
            targetPath,
            path.posix.join(
              resource,
              item.name,
              normalizeTargetPathString(path.relative(overridePath, filePath))
            )
          ),
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
  const targetDir = resolveProjectionPath(root, options.targetDir, "Target");
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
  const { matcher, diagnostics: ignoreDiagnostics } =
    await loadHarnessIgnoreMatcherDetailed(root, {
      sourceRoots: [sourceDir],
      targetRoots: [targetDir],
    });
  diagnostics.push(...ignoreDiagnostics);
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
      toRepoRelative(root, path.join(targetDir, relativeFromItem)),
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
      toRepoRelative(
        root,
        path.join(targetDir, path.relative(overridePath, filePath))
      ),
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

async function readProtectedTargetFiles(
  root: string,
  targetRoot: string,
  protectedTargetPaths: string[]
): Promise<Map<string, Buffer>> {
  const protectedFiles = new Map<string, Buffer>();
  for (const relativePath of protectedTargetPathsForRoot(
    root,
    targetRoot,
    protectedTargetPaths
  )) {
    if (!relativePath) {
      continue;
    }
    const bytes = await readFile(path.join(targetRoot, relativePath)).catch(
      () => undefined
    );
    if (bytes) {
      protectedFiles.set(relativePath, bytes);
    }
  }
  return protectedFiles;
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
  mutablePolicy: MutablePolicy,
  protectedRelativePaths: Set<string> = new Set()
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
    if (isProtectedTargetIgnorePath(relativePath, protectedRelativePaths)) {
      continue;
    }
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
      isProtectedTargetIgnoreAncestor(relativePath, protectedRelativePaths)
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
    const root = protectedUnmanagedEntryRoot(
      relativePath,
      unmanagedEntryRoot(relativePath, managedItemRoots),
      protectedRelativePaths
    );
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

function isProtectedTargetIgnorePath(
  relativePath: string,
  protectedRelativePaths: Set<string>
): boolean {
  return protectedRelativePaths.has(normalizeTargetPathString(relativePath));
}

function isProtectedTargetIgnoreAncestor(
  relativePath: string,
  protectedRelativePaths: Set<string>
): boolean {
  const normalized = normalizeTargetPathString(relativePath);
  return [...protectedRelativePaths].some((protectedPath) =>
    protectedPath.startsWith(`${normalized}/`)
  );
}

function protectedUnmanagedEntryRoot(
  relativePath: string,
  proposedRoot: string,
  protectedRelativePaths: Set<string>
): string {
  const normalizedRoot = normalizeTargetPathString(proposedRoot);
  if (
    normalizedRoot !== normalizeTargetPathString(relativePath) &&
    isProtectedTargetIgnoreAncestor(normalizedRoot, protectedRelativePaths)
  ) {
    return relativePath;
  }
  return proposedRoot;
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
  const sourceDir = resolveProjectionPath(root, options.sourceDir, "Resource");
  const targetDir = resolveProjectionPath(root, options.targetDir, "Target");
  const { protectedTargetPaths } = await loadHarnessIgnoreMatcherDetailed(
    root,
    {
      sourceRoots: [sourceDir],
      targetRoots: [targetDir],
    }
  );
  const protectedFiles = await readProtectedTargetFiles(
    root,
    targetDir,
    protectedTargetPaths
  );
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

  for (const [relativePath, bytes] of protectedFiles) {
    const targetPath = path.join(targetDir, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, bytes);
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

function normalizeTargetPathString(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function partitionDirOutputsByTarget(
  config: HarnessConfig,
  outputs: DirOutput[]
): {
  byTarget: Map<string, DirOutput[]>;
  repoRoot: DirOutput[];
} {
  const byTarget = new Map<string, DirOutput[]>();
  const repoRoot: DirOutput[] = [];
  const targetPaths = listHarnessProjectionTargets(config).map((target) => ({
    raw: target,
    normalized: normalizeTargetPathString(target),
  }));

  for (const output of outputs) {
    const normalizedOutput = normalizeTargetPathString(output.relativePath);
    const match = targetPaths.find(
      (target) =>
        normalizedOutput === target.normalized ||
        normalizedOutput.startsWith(`${target.normalized}/`)
    );
    if (match) {
      const list = byTarget.get(match.raw) ?? [];
      list.push(output);
      byTarget.set(match.raw, list);
      continue;
    }
    repoRoot.push(output);
  }

  return { byTarget, repoRoot };
}

function mergeDirOutputsIntoProjection(
  projection: DesiredProjection,
  targetPath: string,
  dirOutputs: DirOutput[],
  diagnostics: HarnessDiagnostic[]
): void {
  const targetNormalized = normalizeTargetPathString(targetPath);
  for (const output of dirOutputs) {
    const normalizedOutput = normalizeTargetPathString(output.relativePath);
    const relativeKey =
      normalizedOutput === targetNormalized
        ? ""
        : normalizedOutput.slice(targetNormalized.length + 1);
    if (!relativeKey) {
      continue;
    }
    const existing = projection.get(relativeKey);
    if (existing) {
      diagnostics.push({
        severity: "error",
        code: "harness.projection_path_conflict",
        message: `Dir output "${output.relativePath}" collides with a resource projection already producing "${relativeKey}" inside target "${targetPath}".`,
        path: output.sourcePaths[0] ?? output.relativePath,
        recommendation:
          "Move the dir source or the resource override so the two do not produce the same path.",
      });
      continue;
    }
    projection.set(relativeKey, {
      bytes: output.bytes,
      sourcePath: output.sourcePaths[0] ?? output.relativePath,
      relativePath: relativeKey,
      mutable: false,
    });
  }
}

function protectedTargetPathsForRoot(
  root: string,
  targetRoot: string,
  protectedTargetPaths: string[]
): Set<string> {
  const targetRelative = normalizeTargetPathString(
    toRepoRelative(root, targetRoot)
  );
  const protectedRelativePaths = new Set<string>();
  for (const protectedPath of protectedTargetPaths) {
    const normalized = normalizeTargetPathString(protectedPath);
    if (normalized.startsWith(`${targetRelative}/`)) {
      protectedRelativePaths.add(normalized.slice(targetRelative.length + 1));
    }
  }
  return protectedRelativePaths;
}

async function planDirRepoRootActions(
  root: string,
  outputs: DirOutput[]
): Promise<HarnessActivationDirAction[]> {
  const actions: HarnessActivationDirAction[] = [];
  for (const output of outputs) {
    const targetPath = path.resolve(root, output.relativePath);
    const existing = await lstat(targetPath).catch(() => undefined);
    const baseAction = {
      relativePath: output.relativePath,
      sourcePaths: output.sourcePaths,
      targetPath,
      outputKind: output.kind,
    };
    if (!existing) {
      actions.push({ ...baseAction, kind: "create" });
      continue;
    }
    if (!existing.isFile()) {
      const kind = existing.isSymbolicLink()
        ? "symlink"
        : existing.isDirectory()
          ? "directory"
          : "non-file";
      actions.push({
        ...baseAction,
        kind: "update",
        reason: `replace existing ${kind} with dir output`,
      });
      continue;
    }
    const current = await readFile(targetPath);
    if (current.equals(output.bytes)) {
      actions.push({ ...baseAction, kind: "keep" });
      continue;
    }
    actions.push({ ...baseAction, kind: "update" });
  }
  return actions.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
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

  const emptyDirPlan: HarnessActivationDirPlan = {
    enabled: false,
    actions: [],
  };

  if (!config) {
    return {
      root: absoluteRoot,
      idempotent: true,
      targets: [],
      dir: emptyDirPlan,
      diagnostics,
    };
  }

  const dirPlanState = await planHarnessDir(absoluteRoot, config);
  diagnostics.push(...dirPlanState.diagnostics);
  const dirOutputs = dirPlanState.outputs;
  const { byTarget: dirByTarget, repoRoot: dirRepoRootOutputs } =
    partitionDirOutputsByTarget(config, dirOutputs);
  const { protectedTargetPaths } = await loadHarnessIgnoreMatcherDetailed(
    absoluteRoot,
    { config }
  );

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
    mergeDirOutputsIntoProjection(
      targetProjection,
      targetPath,
      dirByTarget.get(targetPath) ?? [],
      diagnostics
    );
    const actions = await planCopyActions(
      targetRoot,
      targetProjection,
      cleanupUnmanaged,
      mutablePolicy,
      protectedTargetPathsForRoot(
        absoluteRoot,
        targetRoot,
        protectedTargetPaths
      )
    );

    plans.push({
      path: targetPath,
      override: inferHarnessOverrideDirectory(targetPath) ?? "",
      strategy: "copy",
      actions,
    });
  }

  const dirRepoRootActions = await planDirRepoRootActions(
    absoluteRoot,
    dirRepoRootOutputs
  );

  return {
    root: absoluteRoot,
    idempotent: true,
    targets: plans,
    dir: {
      enabled: dirPlanState.enabled,
      path: dirPlanState.path,
      actions: dirRepoRootActions,
    },
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
  const appliedDirActions: HarnessActivationDirAction[] = [];

  if (dryRun) {
    return {
      root: plan.root,
      dryRun: true,
      plan,
      appliedActions,
      appliedDirActions,
    };
  }

  if (hasErrors) {
    throw new Error(
      "Cannot activate while HarnessConfig validation has errors."
    );
  }

  const config = await loadConfig(plan.root);
  const dirPlanState = await planHarnessDir(plan.root, config);
  const { byTarget: dirByTarget } = partitionDirOutputsByTarget(
    config,
    dirPlanState.outputs
  );

  for (const target of plan.targets) {
    const targetRoot = assertRepoLocalPath(
      plan.root,
      resolveRepoLocalPath(plan.root, target.path, `Target "${target.path}"`),
      `Target "${target.path}"`
    );
    let projection = projections.get(target.path);
    if (!projection) {
      projection = await buildProjection(
        plan.root,
        config,
        target.path,
        plan.diagnostics
      );
      mergeDirOutputsIntoProjection(
        projection,
        target.path,
        dirByTarget.get(target.path) ?? [],
        plan.diagnostics
      );
      projections.set(target.path, projection);
    }
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

  for (const action of plan.dir.actions) {
    if (!(action.kind === "create" || action.kind === "update")) {
      continue;
    }
    const output = dirPlanState.outputs.find(
      (entry) => entry.relativePath === action.relativePath
    );
    if (!output) {
      continue;
    }
    const existing = await lstat(action.targetPath).catch(() => undefined);
    if (existing && !existing.isFile()) {
      await rm(action.targetPath, { recursive: true, force: true });
    }
    await mkdir(path.dirname(action.targetPath), { recursive: true });
    await writeFile(action.targetPath, output.bytes);
    appliedDirActions.push(action);
  }

  return {
    root: plan.root,
    dryRun: false,
    plan,
    appliedActions,
    appliedDirActions,
  };
}
