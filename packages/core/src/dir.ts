import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { loadHarnessIgnoreMatcherDetailed } from "./ignore";
import {
  assertRepoLocalPath,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import { type HarnessConfig, listHarnessProjectionTargets } from "./standard";
import type { HarnessDiagnostic, HarnessIgnoreMatcher } from "./types";

export const HARNESS_COMPOSABLE_MARKER = ".harnessComposable";
export const HARNESS_COMPOSABLE_REF_FILE = ".ref";
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
};

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

type ComposableLeaf = {
  kind: "composable";
  absolutePath: string;
  relativePath: string;
  parts: LocalPart[];
  refSourcePath?: string;
  refTargetRelativePath?: string;
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
  root: string,
  absolutePath: string,
  isDirectory: boolean,
  outputPath?: string
): boolean {
  return matcher.ignores(toRepoRelative(root, absolutePath), {
    globalOnly: true,
    isDirectory,
    outputPath,
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

async function classifyEntries(
  root: string,
  dirRoot: string,
  entries: DirectoryEntry[],
  matcher: HarnessIgnoreMatcher,
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
    const outputPath = normalizeRelative(
      path.relative(dirRoot, entry.absolutePath)
    );
    if (entryType === "directory") {
      if (!shouldIgnore(matcher, root, entry.absolutePath, true, outputPath)) {
        directories.push(entry);
      }
      continue;
    }

    if (entryType === "file") {
      if (entry.name === HARNESS_COMPOSABLE_MARKER) {
        hasMarker = true;
        continue;
      }
      if (!shouldIgnore(matcher, root, entry.absolutePath, false, outputPath)) {
        files.push(entry);
      }
      continue;
    }

    if (!shouldIgnore(matcher, root, entry.absolutePath, false, outputPath)) {
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
  dirRoot: string,
  leafDirectory: string,
  files: DirectoryEntry[],
  leaf: ComposableLeaf,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  for (const file of files) {
    if (file.name === HARNESS_COMPOSABLE_REF_FILE) {
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
          message: ".ref must contain exactly one relative composable path.",
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
        path.relative(dirRoot, path.resolve(leafDirectory, refLine))
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
      order: Number.parseInt(partMatch.groups.order, 10),
      sourcePath: file.absolutePath,
      bytes,
      local: true,
    });
  }
}

function resolveRefTargets(
  root: string,
  dirRoot: string,
  leaves: Map<string, ComposableLeaf>,
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
        message: ".ref targets must stay inside the dir source root.",
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
        message: ".ref targets must stay inside the dir source root.",
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
        message: `.ref target "${refTarget}" does not resolve to an included composable leaf.`,
        path: leaf.refSourcePath
          ? toRepoRelative(root, leaf.refSourcePath)
          : toRepoRelative(root, leaf.absolutePath),
        recommendation:
          "Point .ref at another composable directory or update .harnessIgnore.",
      });
      leaf.refTargetRelativePath = undefined;
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
      message: `Composable .ref cycle detected: ${[
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

async function walkDir(
  root: string,
  dirRoot: string,
  directory: string,
  matcher: HarnessIgnoreMatcher,
  composableLeaves: Map<string, ComposableLeaf>,
  copyOutputs: Map<
    string,
    { bytes: Buffer; sourcePath: string; relativePath: string }
  >,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  const isRoot = path.resolve(directory) === path.resolve(dirRoot);
  const outputPath = normalizeRelative(path.relative(dirRoot, directory));
  if (!isRoot && shouldIgnore(matcher, root, directory, true, outputPath)) {
    return;
  }

  const entries = await readDirectoryEntries(root, directory, diagnostics);
  if (!entries) {
    return;
  }

  const { files, directories, hasMarker } = await classifyEntries(
    root,
    dirRoot,
    entries,
    matcher,
    diagnostics
  );

  if (hasMarker) {
    const relativePath = normalizeRelative(path.relative(dirRoot, directory));
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
    const leaf: ComposableLeaf = {
      kind: "composable",
      absolutePath: directory,
      relativePath,
      parts: [],
    };
    await readComposableParts(
      root,
      dirRoot,
      directory,
      files,
      leaf,
      diagnostics
    );
    composableLeaves.set(relativePath, leaf);
    return;
  }

  // Copy mode: individual files copy as-is, then recurse into subdirectories.
  for (const file of files) {
    const outputRelativePath = normalizeRelative(
      path.relative(dirRoot, file.absolutePath)
    );
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
        dirRoot,
        entry.absolutePath,
        matcher,
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
  dirRoot: string,
  matcher: HarnessIgnoreMatcher,
  diagnostics: HarnessDiagnostic[]
): Promise<DirOutput[]> {
  const composableLeaves = new Map<string, ComposableLeaf>();
  const copyOutputs = new Map<
    string,
    { bytes: Buffer; sourcePath: string; relativePath: string }
  >();
  await walkDir(
    root,
    dirRoot,
    dirRoot,
    matcher,
    composableLeaves,
    copyOutputs,
    diagnostics
  );
  resolveRefTargets(root, dirRoot, composableLeaves, diagnostics);

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
    const parts = expandParts(leaf, composableLeaves, diagnostics);
    const sourcePaths = [
      ...(leaf.refSourcePath ? [leaf.refSourcePath] : []),
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

export async function planHarnessDir(
  root: string,
  config: HarnessConfig
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

  const bootstrap = await loadHarnessIgnoreMatcherDetailed(root, { config });
  const bootstrapOutputs = await collectDirOutputs(
    root,
    config,
    dirRoot,
    bootstrap.matcher,
    []
  );
  const { matcher, diagnostics: ignoreDiagnostics } =
    await loadHarnessIgnoreMatcherDetailed(root, {
      config,
      targetOutputPaths: bootstrapOutputs.map((output) => output.relativePath),
    });
  diagnostics.push(...ignoreDiagnostics);
  const outputs = await collectDirOutputs(
    root,
    config,
    dirRoot,
    matcher,
    diagnostics
  );

  return {
    enabled: true,
    path: dirRootRelative,
    outputs,
    diagnostics,
  };
}
