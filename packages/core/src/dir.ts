import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { loadHarnessIgnoreMatcherDetailed } from "./ignore";
import {
  assertRepoLocalPath,
  HARNESS_IGNORE_FILE,
  HARNESS_PROFILE_FILE,
  HARNESS_PROFILE_ROOT_FILE,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import {
  loadHarnessProfileContext,
  profileSourceDirForRoot,
  type HarnessProfileContext,
  type HarnessProfileRoot,
} from "./profile";
import { type HarnessConfig, listHarnessProjectionTargets } from "./standard";
import type { HarnessDiagnostic, HarnessIgnoreMatcher } from "./types";

export const HARNESS_COMPOSABLE_MARKER = ".harnessComposable";
export const HARNESS_COMPOSABLE_REF_FILE = ".harnessRef";
const COMPOSABLE_PART_PATTERN = /^(?<order>[0-9]+)_.+$/;

export type DirOutputKind = "composable" | "copy";

export type DirOutput = {
  kind: DirOutputKind;
  bytes: Buffer;
  relativePath: string;
  sourcePaths: string[];
};

export type HarnessDirPlan = {
  enabled: boolean;
  path?: string;
  outputs: DirOutput[];
  diagnostics: HarnessDiagnostic[];
  profileContext?: HarnessProfileContext;
};

export type HarnessDirPlanOptions = {
  profileContext?: HarnessProfileContext;
};

type DirectoryEntry = {
  absolutePath: string;
  name: string;
};

type DirSourceLayer = {
  logicalRoot: string;
  outputPrefix?: string;
  physicalRoot: string;
  profile?: string;
  profileRoot?: HarnessProfileRoot;
};

type LocalPart = {
  leafRelativePath: string;
  order: number;
  sourcePath: string;
  bytes: Buffer;
  local: boolean;
};

type ComposableLeaf = {
  kind: "composable";
  absolutePath: string;
  relativePath: string;
  parts: LocalPart[];
  harnessRefSourcePath?: string;
  harnessRefTargetRelativePath?: string;
};

type EntryType = "directory" | "file" | "symlink" | "other";

function entryTypeFromStat(
  stat: Awaited<ReturnType<typeof lstat>>
): EntryType | undefined {
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

function normalizeRelative(input: string): string {
  return input.split(path.sep).join("/");
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    !relative || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function shouldIgnore(
  matcher: HarnessIgnoreMatcher,
  sourceRelativePath: string,
  isDirectory: boolean,
  outputPath?: string,
  profile?: string,
  physicalSourceRelativePath?: string
): boolean {
  if (
    physicalSourceRelativePath &&
    physicalSourceRelativePath !== sourceRelativePath &&
    matcher.ignores(physicalSourceRelativePath, {
      isDirectory,
      outputPath,
      profile,
    })
  ) {
    return true;
  }
  return matcher.ignores(sourceRelativePath, {
    isDirectory,
    outputPath,
    profile,
  });
}

function layerRelativePath(
  layer: DirSourceLayer,
  absolutePath: string
): string {
  const relative = normalizeRelative(
    path.relative(layer.physicalRoot, absolutePath)
  );
  if (!relative) {
    return normalizeRelative(layer.outputPrefix ?? "");
  }
  return normalizeRelative(path.join(layer.outputPrefix ?? "", relative));
}

function layerLogicalPath(layer: DirSourceLayer, absolutePath: string): string {
  return path.join(
    layer.logicalRoot,
    normalizeRelative(path.relative(layer.physicalRoot, absolutePath))
  );
}

function layerLogicalRepoPath(
  root: string,
  layer: DirSourceLayer,
  absolutePath: string
): string {
  return toRepoRelative(root, layerLogicalPath(layer, absolutePath));
}

function layerPhysicalRepoPath(root: string, absolutePath: string): string {
  return toRepoRelative(root, absolutePath);
}

function outputProfile(
  profileContext: HarnessProfileContext,
  outputPath: string
): string | undefined {
  return profileContext.profileForOutput(outputPath);
}

function layerProfileApplies(
  layer: DirSourceLayer,
  profileContext: HarnessProfileContext,
  outputPath: string
): boolean {
  return (
    layer.profile === undefined ||
    outputProfile(profileContext, outputPath) === layer.profile
  );
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

async function classifyEntries(
  root: string,
  layer: DirSourceLayer,
  entries: DirectoryEntry[],
  matcher: HarnessIgnoreMatcher,
  profileContext: HarnessProfileContext,
  diagnostics: HarnessDiagnostic[]
): Promise<{
  files: DirectoryEntry[];
  directories: DirectoryEntry[];
  hasMarker: boolean;
}> {
  const files: DirectoryEntry[] = [];
  const directories: DirectoryEntry[] = [];
  let hasMarker = false;

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
    const outputPath = layerRelativePath(layer, entry.absolutePath);
    const sourceRelativePath = layerLogicalRepoPath(
      root,
      layer,
      entry.absolutePath
    );
    const physicalSourceRelativePath = layerPhysicalRepoPath(
      root,
      entry.absolutePath
    );
    const activeProfile = outputProfile(profileContext, outputPath);
    if (entryType === "directory") {
      const markerState = await lstat(
        path.join(entry.absolutePath, HARNESS_PROFILE_ROOT_FILE)
      ).catch(() => undefined);
      if (markerState?.isFile()) {
        continue;
      }
      if (
        !shouldIgnore(
          matcher,
          sourceRelativePath,
          true,
          outputPath,
          activeProfile,
          physicalSourceRelativePath
        )
      ) {
        directories.push(entry);
      }
      continue;
    }

    if (entryType === "file") {
      if (entry.name === HARNESS_COMPOSABLE_MARKER) {
        if (layerProfileApplies(layer, profileContext, outputPath)) {
          hasMarker = true;
        }
        continue;
      }
      if (
        layerProfileApplies(layer, profileContext, outputPath) &&
        !shouldIgnore(
          matcher,
          sourceRelativePath,
          false,
          outputPath,
          activeProfile,
          physicalSourceRelativePath
        )
      ) {
        files.push(entry);
      }
      continue;
    }

    if (
      layerProfileApplies(layer, profileContext, outputPath) &&
      !shouldIgnore(
        matcher,
        sourceRelativePath,
        false,
        outputPath,
        activeProfile,
        physicalSourceRelativePath
      )
    ) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_invalid_entry",
        message: `Dir entries must be regular files or directories, not ${entryType}.`,
        path: toRepoRelative(root, entry.absolutePath),
        recommendation: "Move this entry or exclude it with .harnessIgnore.",
      });
    }
  }

  // Stable ordering — sort by name to keep output deterministic.
  files.sort((left, right) => left.name.localeCompare(right.name));
  directories.sort((left, right) => left.name.localeCompare(right.name));

  return { files, directories, hasMarker };
}

async function readComposableParts(
  root: string,
  files: DirectoryEntry[],
  leaf: ComposableLeaf,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  for (const file of files) {
    if (file.name === HARNESS_COMPOSABLE_REF_FILE) {
      const rawHarnessRef = await readFile(file.absolutePath, "utf8").catch(
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
      if (rawHarnessRef === undefined) {
        continue;
      }
      const refLines = rawHarnessRef
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (refLines.length !== 1) {
        diagnostics.push({
          severity: "error",
          code: "harness.dir_ref_invalid",
          message:
            ".harnessRef must contain exactly one relative composable path.",
          path: toRepoRelative(root, file.absolutePath),
        });
        continue;
      }
      const refLine = refLines[0] ?? "";
      if (path.isAbsolute(refLine)) {
        diagnostics.push({
          severity: "error",
          code: "harness.dir_ref_absolute",
          message: ".harnessRef targets must be relative paths.",
          path: toRepoRelative(root, file.absolutePath),
        });
        continue;
      }
      leaf.harnessRefSourcePath = file.absolutePath;
      leaf.harnessRefTargetRelativePath = normalizeRelative(
        path.posix.normalize(path.posix.join(leaf.relativePath, refLine))
      );
      continue;
    }

    const partMatch = file.name.match(COMPOSABLE_PART_PATTERN);
    if (!partMatch?.groups?.order) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_invalid_part",
        message:
          'Composable part files must start with a numeric prefix and underscore, such as "100_intro.md".',
        path: toRepoRelative(root, file.absolutePath),
        recommendation:
          "Rename this file, exclude it with .harnessIgnore, or remove the .harnessComposable marker to switch to copy mode.",
      });
      continue;
    }

    const bytes = await readFile(file.absolutePath).catch((error: unknown) => {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_part_read_failed",
        message: error instanceof Error ? error.message : String(error),
        path: toRepoRelative(root, file.absolutePath),
      });
      return undefined;
    });
    if (!bytes) {
      return;
    }

    leaf.parts.push({
      leafRelativePath: leaf.relativePath,
      order: Number.parseInt(partMatch.groups.order, 10),
      sourcePath: file.absolutePath,
      bytes,
      local: true,
    });
  }
}

function resolveRefTargets(
  root: string,
  leaves: Map<string, ComposableLeaf>,
  diagnostics: HarnessDiagnostic[]
): void {
  for (const leaf of leaves.values()) {
    const refTarget = leaf.harnessRefTargetRelativePath;
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
        message: ".harnessRef targets must stay inside the dir source root.",
        path: leaf.harnessRefSourcePath
          ? toRepoRelative(root, leaf.harnessRefSourcePath)
          : toRepoRelative(root, leaf.absolutePath),
      });
      leaf.harnessRefTargetRelativePath = undefined;
      continue;
    }

    if (!leaves.has(refTarget)) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_ref_missing",
        message: `.harnessRef target "${refTarget}" does not resolve to an included composable leaf.`,
        path: leaf.harnessRefSourcePath
          ? toRepoRelative(root, leaf.harnessRefSourcePath)
          : toRepoRelative(root, leaf.absolutePath),
        recommendation:
          "Point .harnessRef at another composable directory or update .harnessIgnore.",
      });
      leaf.harnessRefTargetRelativePath = undefined;
    }
  }
}

function expandParts(
  leaf: ComposableLeaf,
  leaves: Map<string, ComposableLeaf>,
  diagnostics: HarnessDiagnostic[],
  stack: string[] = []
): LocalPart[] {
  if (stack.includes(leaf.relativePath)) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_ref_cycle",
      message: `Composable .harnessRef cycle detected: ${[
        ...stack,
        leaf.relativePath,
      ].join(" -> ")}.`,
      path: leaf.harnessRefSourcePath,
      recommendation: "Remove one .harnessRef edge from the cycle.",
    });
    return [];
  }

  const imported = leaf.harnessRefTargetRelativePath
    ? expandParts(
        leaves.get(leaf.harnessRefTargetRelativePath) ?? leaf,
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

function recipientLocalImportedPartPath(
  root: string,
  leaf: ComposableLeaf,
  part: LocalPart
): string | undefined {
  if (part.local) {
    return undefined;
  }
  return normalizeRelative(
    path.posix.join(
      toRepoRelative(root, leaf.absolutePath),
      part.leafRelativePath,
      path.basename(part.sourcePath)
    )
  );
}

function filtersImportedPartForRecipient(
  root: string,
  matcher: HarnessIgnoreMatcher,
  profileContext: HarnessProfileContext,
  leaf: ComposableLeaf,
  part: LocalPart
): boolean {
  const recipientLocalPath = recipientLocalImportedPartPath(root, leaf, part);
  if (!recipientLocalPath) {
    return false;
  }
  return matcher.ignores(recipientLocalPath, {
    outputPath: leaf.relativePath,
    profile: outputProfile(profileContext, leaf.relativePath),
  });
}

async function walkDir(
  root: string,
  layer: DirSourceLayer,
  directory: string,
  matcher: HarnessIgnoreMatcher,
  profileContext: HarnessProfileContext,
  composableLeaves: Map<string, ComposableLeaf>,
  copyOutputs: Map<
    string,
    { bytes: Buffer; sourcePath: string; relativePath: string }
  >,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  const isRoot = path.resolve(directory) === path.resolve(layer.physicalRoot);
  const outputPath = layerRelativePath(layer, directory);
  if (
    layer.profile &&
    !profileContext.profileCanApplyWithin(outputPath, layer.profile)
  ) {
    return;
  }
  if (!isRoot) {
    const activeProfile = outputProfile(profileContext, outputPath);
    if (
      shouldIgnore(
        matcher,
        layerLogicalRepoPath(root, layer, directory),
        true,
        outputPath,
        activeProfile,
        layerPhysicalRepoPath(root, directory)
      )
    ) {
      return;
    }
  }

  const entries = await readDirectoryEntries(root, directory, diagnostics);
  if (!entries) {
    return;
  }

  const { files, directories, hasMarker } = await classifyEntries(
    root,
    layer,
    entries,
    matcher,
    profileContext,
    diagnostics
  );

  const relativePath = layerRelativePath(layer, directory);
  const contributesToExistingLeaf =
    Boolean(layer.profile) &&
    composableLeaves.has(relativePath) &&
    files.length > 0;

  if (hasMarker || contributesToExistingLeaf) {
    if (!relativePath) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_marker_at_root",
        message:
          "The dir source root cannot itself be a composable leaf. Move the .harnessComposable marker into a subdirectory.",
        path: toRepoRelative(
          root,
          path.join(directory, HARNESS_COMPOSABLE_MARKER)
        ),
      });
      return;
    }
    if (directories.length > 0) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_mixed_container",
        message:
          "A composable directory (with .harnessComposable) cannot contain subdirectories.",
        path: toRepoRelative(root, directory),
        recommendation:
          "Move subdirectories outside this composable leaf, or remove the .harnessComposable marker to use copy mode.",
      });
      return;
    }
    const leaf = composableLeaves.get(relativePath) ?? {
      kind: "composable",
      absolutePath: directory,
      relativePath,
      parts: [],
    };
    await readComposableParts(root, files, leaf, diagnostics);
    composableLeaves.set(relativePath, leaf);
    return;
  }

  // Copy mode: individual files copy as-is, then recurse into subdirectories.
  for (const file of files) {
    const outputRelativePath = layerRelativePath(layer, file.absolutePath);
    if (!outputRelativePath) {
      continue;
    }
    const bytes = await readFile(file.absolutePath).catch((error: unknown) => {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_file_read_failed",
        message: error instanceof Error ? error.message : String(error),
        path: toRepoRelative(root, file.absolutePath),
      });
      return undefined;
    });
    if (!bytes) {
      continue;
    }
    copyOutputs.set(outputRelativePath, {
      bytes,
      sourcePath: file.absolutePath,
      relativePath: outputRelativePath,
    });
  }

  await Promise.all(
    directories.map((entry) =>
      walkDir(
        root,
        layer,
        entry.absolutePath,
        matcher,
        profileContext,
        composableLeaves,
        copyOutputs,
        diagnostics
      )
    )
  );
}

function validateDirOutputPath(
  root: string,
  config: HarnessConfig,
  relativePath: string,
  diagnostics: HarnessDiagnostic[]
): string | undefined {
  const targetPath = assertRepoLocalPath(
    root,
    path.resolve(root, relativePath),
    `Dir output "${relativePath}"`
  );
  const harnessDir = resolveHarnessPaths(root).harnessDir;

  if (isInsideOrEqual(harnessDir, targetPath)) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_output_inside_harness",
      message: `Dir output "${relativePath}" cannot write inside .harness.`,
      path: relativePath,
      recommendation: "Choose an output path outside .harness.",
    });
    return undefined;
  }

  // dir outputs may overlap declared targets — they become part of the
  // target's managed projection during activation. The only conflict is
  // when a dir output lands at the target ROOT, which would replace the
  // entire target directory.
  for (const target of listHarnessProjectionTargets(config)) {
    const targetRoot = resolveRepoLocalPath(
      root,
      target,
      `Target "${target}" path`
    );
    if (
      path.resolve(targetRoot) === path.resolve(targetPath) ||
      isInsideOrEqual(targetPath, targetRoot)
    ) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_output_target_overlap",
        message: `Dir output "${relativePath}" would replace or contain declared target "${target}".`,
        path: relativePath,
        recommendation:
          "Pick a path that does not collide with a declared target root.",
      });
      return undefined;
    }
  }

  return targetPath;
}

function resolveDirRoot(root: string, config: HarnessConfig): string {
  const configured = config.dir?.path ?? "./.harness/dir";
  return resolveRepoLocalPath(root, configured, "Dir source path");
}

function dirEnabled(config: HarnessConfig): boolean {
  return config.dir !== undefined;
}

async function dirRootState(
  dirRoot: string
): Promise<{ exists: boolean; isDirectory: boolean; isSymlink: boolean }> {
  const stat = await lstat(dirRoot).catch(() => undefined);
  if (!stat) {
    return { exists: false, isDirectory: false, isSymlink: false };
  }
  return {
    exists: true,
    isDirectory: stat.isDirectory(),
    isSymlink: stat.isSymbolicLink(),
  };
}

async function collectDirOutputs(
  root: string,
  config: HarnessConfig,
  layers: DirSourceLayer[],
  matcher: HarnessIgnoreMatcher,
  profileContext: HarnessProfileContext,
  diagnostics: HarnessDiagnostic[]
): Promise<DirOutput[]> {
  const composableLeaves = new Map<string, ComposableLeaf>();
  const copyOutputs = new Map<
    string,
    { bytes: Buffer; sourcePath: string; relativePath: string }
  >();
  for (const layer of layers) {
    await walkDir(
      root,
      layer,
      layer.physicalRoot,
      matcher,
      profileContext,
      composableLeaves,
      copyOutputs,
      diagnostics
    );
  }
  resolveRefTargets(root, composableLeaves, diagnostics);

  const outputs: DirOutput[] = [];

  for (const leaf of composableLeaves.values()) {
    const targetPath = validateDirOutputPath(
      root,
      config,
      leaf.relativePath,
      diagnostics
    );
    if (!targetPath) {
      continue;
    }
    const parts = expandParts(leaf, composableLeaves, diagnostics).filter(
      (part) =>
        !filtersImportedPartForRecipient(
          root,
          matcher,
          profileContext,
          leaf,
          part
        )
    );
    const sourcePaths = [
      ...(leaf.harnessRefSourcePath ? [leaf.harnessRefSourcePath] : []),
      ...parts.map((part) => part.sourcePath),
    ];
    outputs.push({
      kind: "composable",
      bytes: Buffer.concat(parts.map((part) => part.bytes)),
      relativePath: leaf.relativePath,
      sourcePaths,
    });
  }

  for (const copy of copyOutputs.values()) {
    if (composableLeaves.has(copy.relativePath)) {
      diagnostics.push({
        severity: "error",
        code: "harness.dir_path_conflict",
        message: `Copy file "${toRepoRelative(
          root,
          copy.sourcePath
        )}" conflicts with composable leaf "${copy.relativePath}".`,
        path: toRepoRelative(root, copy.sourcePath),
      });
      continue;
    }
    const targetPath = validateDirOutputPath(
      root,
      config,
      copy.relativePath,
      diagnostics
    );
    if (!targetPath) {
      continue;
    }
    outputs.push({
      kind: "copy",
      bytes: copy.bytes,
      relativePath: copy.relativePath,
      sourcePaths: [copy.sourcePath],
    });
  }

  const sortedRelativePaths = outputs.map((output) => output.relativePath);
  for (
    let leftIndex = 0;
    leftIndex < sortedRelativePaths.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sortedRelativePaths.length;
      rightIndex += 1
    ) {
      const left = sortedRelativePaths[leftIndex];
      const right = sortedRelativePaths[rightIndex];
      if (!(left && right)) {
        continue;
      }
      if (left.startsWith(`${right}/`) || right.startsWith(`${left}/`)) {
        const offending = outputs[leftIndex];
        if (!offending) {
          continue;
        }
        diagnostics.push({
          severity: "error",
          code: "harness.dir_path_conflict",
          message: `Dir outputs "${left}" and "${right}" cannot coexist: one would need to be both a file and a directory.`,
          path: toRepoRelative(
            root,
            offending.sourcePaths[0] ?? offending.relativePath
          ),
        });
      }
    }
  }

  return outputs.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
}

function isCandidateDeclarationFile(name: string): boolean {
  return (
    name === HARNESS_COMPOSABLE_MARKER ||
    name === HARNESS_IGNORE_FILE ||
    name === HARNESS_PROFILE_FILE ||
    name === HARNESS_PROFILE_ROOT_FILE
  );
}

async function hasProfileRootMarker(directory: string): Promise<boolean> {
  const marker = await lstat(
    path.join(directory, HARNESS_PROFILE_ROOT_FILE)
  ).catch(() => undefined);
  return Boolean(marker?.isFile());
}

async function collectLayerCandidateOutputPaths(
  layer: DirSourceLayer,
  directory: string,
  outputPaths: Set<string>
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => []
  );
  const files: string[] = [];
  const directories: string[] = [];
  let hasMarker = false;

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const stat = await lstat(absolutePath).catch(() => undefined);
    if (!stat) {
      continue;
    }
    const entryType = entryTypeFromStat(stat);
    if (entryType === "directory") {
      if (await hasProfileRootMarker(absolutePath)) {
        continue;
      }
      directories.push(absolutePath);
      continue;
    }
    if (entryType !== "file") {
      continue;
    }
    if (entry.name === HARNESS_COMPOSABLE_MARKER) {
      hasMarker = true;
      continue;
    }
    if (!isCandidateDeclarationFile(entry.name)) {
      files.push(absolutePath);
    }
  }

  if (hasMarker) {
    const outputPath = layerRelativePath(layer, directory);
    if (outputPath) {
      outputPaths.add(outputPath);
    }
    return;
  }

  for (const file of files) {
    const outputPath = layerRelativePath(layer, file);
    if (outputPath) {
      outputPaths.add(outputPath);
    }
  }

  await Promise.all(
    directories.map((child) =>
      collectLayerCandidateOutputPaths(layer, child, outputPaths)
    )
  );
}

async function collectDirCandidateOutputPaths(
  layers: DirSourceLayer[]
): Promise<string[]> {
  const outputPaths = new Set<string>();
  await Promise.all(
    layers.map((layer) =>
      collectLayerCandidateOutputPaths(layer, layer.physicalRoot, outputPaths)
    )
  );
  return [...outputPaths].sort((left, right) => left.localeCompare(right));
}

async function dirSourceLayers(
  dirRoot: string,
  profileContext: HarnessProfileContext
): Promise<DirSourceLayer[]> {
  const layers: DirSourceLayer[] = [
    {
      logicalRoot: dirRoot,
      physicalRoot: dirRoot,
    },
  ];

  for (const profileRoot of profileContext.profileRoots) {
    const profileOverlaysDirRoot = isInsideOrEqual(
      dirRoot,
      profileRoot.overlayBase
    );
    const physicalRoot = profileOverlaysDirRoot
      ? profileSourceDirForRoot(profileRoot, profileRoot.overlayBase)
      : profileSourceDirForRoot(profileRoot, dirRoot);
    if (!physicalRoot) {
      continue;
    }
    const state = await lstat(physicalRoot).catch(() => undefined);
    if (!state?.isDirectory() || state.isSymbolicLink()) {
      continue;
    }
    layers.push({
      logicalRoot: profileOverlaysDirRoot ? profileRoot.overlayBase : dirRoot,
      outputPrefix: profileOverlaysDirRoot
        ? normalizeRelative(path.relative(dirRoot, profileRoot.overlayBase))
        : "",
      physicalRoot,
      profile: profileRoot.profile,
      profileRoot,
    });
  }

  return layers;
}

export async function planHarnessDir(
  root: string,
  config: HarnessConfig,
  options: HarnessDirPlanOptions = {}
): Promise<HarnessDirPlan> {
  const diagnostics: HarnessDiagnostic[] = [];
  if (!dirEnabled(config)) {
    return {
      enabled: false,
      outputs: [],
      diagnostics,
    };
  }

  const dirRoot = resolveDirRoot(root, config);
  const dirRootRelative = toRepoRelative(root, dirRoot);
  const state = await dirRootState(dirRoot);

  if (!state.exists) {
    diagnostics.push({
      severity: "warning",
      code: "harness.dir_root_missing",
      message: `${dirRootRelative} does not exist.`,
      path: dirRootRelative,
      recommendation:
        "Create the dir source root, configure a different [dir] path, or remove the [dir] declaration.",
    });
    return {
      enabled: true,
      path: dirRootRelative,
      outputs: [],
      diagnostics,
    };
  }

  if (!state.isDirectory || state.isSymlink) {
    diagnostics.push({
      severity: "error",
      code: "harness.dir_root_not_directory",
      message: `${dirRootRelative} must be a real directory.`,
      path: dirRootRelative,
    });
    return {
      enabled: true,
      path: dirRootRelative,
      outputs: [],
      diagnostics,
    };
  }

  const bootstrapProfileContext =
    options.profileContext ??
    (await loadHarnessProfileContext(root, {
      config,
    }));
  const bootstrap = await loadHarnessIgnoreMatcherDetailed(root, {
    config,
    extraRuleSets: bootstrapProfileContext.ignoreRuleSets,
    protectedTargetPaths: bootstrapProfileContext.protectedTargetPaths,
  });
  const bootstrapLayers = await dirSourceLayers(
    dirRoot,
    bootstrapProfileContext
  );
  const bootstrapOutputs = await collectDirOutputs(
    root,
    config,
    bootstrapLayers,
    bootstrap.matcher,
    bootstrapProfileContext,
    []
  );
  const targetOutputPaths = [
    ...new Set([
      ...bootstrapOutputs.map((output) => output.relativePath),
      ...(await collectDirCandidateOutputPaths(bootstrapLayers)),
    ]),
  ].sort((left, right) => left.localeCompare(right));
  const profileContext =
    targetOutputPaths.length === 0
      ? bootstrapProfileContext
      : await loadHarnessProfileContext(root, {
          config,
          targetOutputPaths,
        });
  diagnostics.push(...profileContext.diagnostics);
  const { matcher, diagnostics: ignoreDiagnostics } =
    await loadHarnessIgnoreMatcherDetailed(root, {
      config,
      extraRuleSets: profileContext.ignoreRuleSets,
      protectedTargetPaths: profileContext.protectedTargetPaths,
      targetOutputPaths,
    });
  diagnostics.push(...ignoreDiagnostics);
  const outputs = await collectDirOutputs(
    root,
    config,
    await dirSourceLayers(dirRoot, profileContext),
    matcher,
    profileContext,
    diagnostics
  );

  return {
    enabled: true,
    path: dirRootRelative,
    outputs,
    diagnostics,
    profileContext,
  };
}
