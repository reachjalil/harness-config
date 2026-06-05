import { type Dirent, lstatSync, readdirSync } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_HARNESS_CONFIG_PATH,
  DEFAULT_HARNESS_DIR_PATH,
  DEFAULT_HARNESS_RESOURCES_PATH,
} from "./standard";
import type {
  ConventionalHarnessResource,
  HarnessTargetDefinition,
  HarnessConfigPaths,
  HarnessPathOptions,
} from "./types";

export const HARNESS_CONFIG_DIR = ".harness";
export const HARNESS_CONFIG_FILE = "harness.toml";
export const HARNESS_RESOURCES_DIR = "resources";
export const HARNESS_IGNORE_FILE = ".harnessIgnore";
export const HARNESS_MUTABLE_FILE = ".harnessMutable";
export const HARNESS_PROFILE_FILE = ".harnessProfile";
export const HARNESS_PROFILE_ROOT_FILE = ".harnessProfileRoot";
export const HARNESS_PROFILE_ISOLATION_FILE = ".harnessProfileIsolation";
export const CONVENTIONAL_HARNESS_RESOURCES = [
  "skills",
  "rules",
  "plugins",
] as const satisfies readonly ConventionalHarnessResource[];

export function resolveHarnessPaths(
  root = process.cwd(),
  options: HarnessPathOptions = {}
): HarnessConfigPaths {
  const absoluteRoot = path.resolve(root);
  const harnessDir = path.join(absoluteRoot, HARNESS_CONFIG_DIR);
  const configPath = resolveRepoLocalPath(
    absoluteRoot,
    options.configPath ?? DEFAULT_HARNESS_CONFIG_PATH,
    "Harness config path"
  );
  const resourceSources = options.config?.resources ?? [];
  const dirSources = options.config?.dir ?? [];
  const resourcesDirs = resourceSources.flatMap((source) =>
    resolveRepoLocalDirectoryPattern(
      absoluteRoot,
      source.path,
      `Resources source path "${source.path}"`
    )
  );
  const dirDirs = dirSources.flatMap((source) =>
    resolveRepoLocalDirectoryPattern(
      absoluteRoot,
      source.path,
      `Dir source path "${source.path}"`
    )
  );
  const resourcesDir =
    resourcesDirs[0] ??
    resolveRepoLocalPath(
      absoluteRoot,
      resourceSources[0]?.path ?? DEFAULT_HARNESS_RESOURCES_PATH,
      "Resources source path"
    );

  return {
    root: absoluteRoot,
    harnessDir,
    configPath,
    ignorePath: path.join(absoluteRoot, HARNESS_IGNORE_FILE),
    mutablePath: path.join(absoluteRoot, HARNESS_MUTABLE_FILE),
    resourcesDirs,
    dirDirs,
    resourcesDir,
    skillsDir: path.join(resourcesDir, "skills"),
    rulesDir: path.join(resourcesDir, "rules"),
    pluginsDir: path.join(resourcesDir, "plugins"),
    workspaceReadmePath: path.join(harnessDir, "README.md"),
  };
}

export async function findHarnessIgnoreFiles(
  root = process.cwd(),
  options: HarnessPathOptions = {}
): Promise<string[]> {
  const paths = resolveHarnessPaths(root, options);
  const files: string[] = [];
  const rootIgnoreState = await lstat(paths.ignorePath).catch(() => undefined);
  if (rootIgnoreState?.isFile()) {
    files.push(paths.ignorePath);
  }

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      () => []
    );

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (entry.name === HARNESS_IGNORE_FILE && entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  const sourceRoots = new Set([
    paths.harnessDir,
    ...paths.resourcesDirs,
    ...paths.dirDirs,
  ]);
  for (const sourceRoot of sourceRoots) {
    const state = await lstat(sourceRoot).catch(() => undefined);
    if (!state?.isDirectory() || state.isSymbolicLink()) {
      continue;
    }
    await visit(sourceRoot);
  }
  return files.toSorted((left, right) => left.localeCompare(right));
}

export function detectImplicitOverrideTarget(
  repoRelativePath: string,
  options: { resourcesPath?: string } = {}
): string | undefined {
  const normalizedPath = repoRelativePath
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
  const resourcesPath = (
    options.resourcesPath ?? DEFAULT_HARNESS_RESOURCES_PATH
  )
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .replace(/\/+$/, "");
  if (
    !normalizedPath.endsWith(`/${HARNESS_IGNORE_FILE}`) &&
    !normalizedPath.endsWith(`/${HARNESS_MUTABLE_FILE}`)
  ) {
    return undefined;
  }
  if (
    normalizedPath !== resourcesPath &&
    !normalizedPath.startsWith(`${resourcesPath}/`)
  ) {
    return undefined;
  }

  const segments = normalizedPath
    .slice(resourcesPath.length)
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);
  const rootOverrideSegment = segments[0];
  if (rootOverrideSegment?.startsWith(".")) {
    return rootOverrideSegment;
  }
  const itemOverrideSegment = segments.length >= 4 ? segments[2] : undefined;
  if (itemOverrideSegment?.startsWith(".")) {
    return itemOverrideSegment;
  }

  return undefined;
}

export function defaultHarnessResourcePath(
  resource: ConventionalHarnessResource | string
): string {
  return `${DEFAULT_HARNESS_RESOURCES_PATH}/${resource}`;
}

export function resolveHarnessResourceDir(
  root: string,
  resource: string,
  options: HarnessPathOptions = {}
): string {
  return path.join(resolveHarnessPaths(root, options).resourcesDir, resource);
}

export function resolveHarnessResourceDirs(
  root = process.cwd(),
  options: HarnessPathOptions = {}
): string[] {
  return resolveHarnessPaths(root, options).resourcesDirs;
}

export function resolveHarnessDirDirs(
  root = process.cwd(),
  options: HarnessPathOptions = {}
): string[] {
  return resolveHarnessPaths(root, options).dirDirs;
}

export function defaultHarnessResourcesDefinition(): { path: string } {
  return { path: DEFAULT_HARNESS_RESOURCES_PATH };
}

export function defaultHarnessDirDefinition(): { path: string } {
  return { path: DEFAULT_HARNESS_DIR_PATH };
}

export function resolveHarnessResourceItemDir(
  root: string,
  resource: string,
  name: string,
  options: HarnessPathOptions = {}
): string {
  return path.join(resolveHarnessResourceDir(root, resource, options), name);
}

export function assertRepoLocalPath(
  root: string,
  absolutePath: string,
  label = "Path"
): string {
  const absoluteRoot = path.resolve(root);
  const resolvedPath = path.resolve(absolutePath);
  const relative = path.relative(absoluteRoot, resolvedPath);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `${label} must stay inside the repo: ${
        path.relative(process.cwd(), resolvedPath) || resolvedPath
      }`
    );
  }

  return resolvedPath;
}

export function resolveRepoLocalPath(
  root: string,
  relativePath: string,
  label = "Path"
): string {
  return assertRepoLocalPath(root, path.resolve(root, relativePath), label);
}

export function hasHarnessPathPattern(value: string): boolean {
  return /(^|[^\\])[*?[]/.test(value);
}

function hasEscapedPatternCharacter(value: string): boolean {
  for (let index = 0; index < value.length - 1; index += 1) {
    if (
      value[index] === "\\" &&
      ["*", "?", "["].includes(value[index + 1] ?? "")
    ) {
      return true;
    }
  }
  return false;
}

function usesHarnessPathPatternSyntax(value: string): boolean {
  return hasHarnessPathPattern(value) || hasEscapedPatternCharacter(value);
}

export function resolveRepoLocalDirectoryPattern(
  root: string,
  relativePath: string,
  label = "Path"
): string[] {
  const resolvedPattern = resolveRepoLocalPath(root, relativePath, label);
  if (!usesHarnessPathPatternSyntax(relativePath)) {
    return [resolvedPattern];
  }
  return expandAbsoluteDirectoryPattern(resolvedPattern).map((match) =>
    assertRepoLocalPath(root, match, label)
  );
}

function expandAbsoluteDirectoryPattern(absolutePattern: string): string[] {
  const resolvedPattern = path.resolve(absolutePattern);
  const parsed = path.parse(resolvedPattern);
  const relativePattern = path.relative(parsed.root, resolvedPattern);
  const segments = relativePattern.split(path.sep).filter(Boolean);
  const matches = new Set<string>();

  function visit(directory: string, index: number): void {
    if (index >= segments.length) {
      if (isConcreteDirectory(directory)) {
        matches.add(path.resolve(directory));
      }
      return;
    }

    const segment = segments[index] ?? "";
    if (segment === "**") {
      visit(directory, index + 1);
      for (const child of readDirectoryEntries(directory)) {
        if (!child.isDirectory() || child.isSymbolicLink()) {
          continue;
        }
        visit(path.join(directory, child.name), index);
      }
      return;
    }

    if (!usesHarnessPathPatternSyntax(segment)) {
      visit(path.join(directory, segment), index + 1);
      return;
    }

    const matcher = pathSegmentPatternToRegExp(segment);
    for (const child of readDirectoryEntries(directory)) {
      if (
        !child.isDirectory() ||
        child.isSymbolicLink() ||
        !matcher.test(child.name)
      ) {
        continue;
      }
      visit(path.join(directory, child.name), index + 1);
    }
  }

  visit(parsed.root, 0);
  return [...matches].toSorted((left, right) => left.localeCompare(right));
}

function readDirectoryEntries(directory: string): Dirent<string>[] {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isConcreteDirectory(directory: string): boolean {
  try {
    const state = lstatSync(directory);
    return state.isDirectory() && !state.isSymbolicLink();
  } catch {
    return false;
  }
}

function pathSegmentPatternToRegExp(segment: string): RegExp {
  let source = "";
  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index] ?? "";
    if (char === "\\") {
      const next = segment[index + 1];
      if (next) {
        source += escapeRegExp(next);
        index += 1;
        continue;
      }
      source += "\\\\";
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    if (char === "[") {
      const end = segment.indexOf("]", index + 1);
      if (end > index + 1) {
        const classBody = segment.slice(index + 1, end);
        const negated = classBody.startsWith("!");
        const normalizedClassBody = (negated ? classBody.slice(1) : classBody)
          .replaceAll("\\", "\\\\")
          .replaceAll("]", "\\]");
        if (!normalizedClassBody) {
          source += escapeRegExp(segment.slice(index, end + 1));
          index = end;
          continue;
        }
        source += `[${negated ? "^" : ""}${normalizedClassBody}]`;
        index = end;
        continue;
      }
    }
    source += escapeRegExp(char);
  }
  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

export type HarnessTargetRootMapping = {
  root: string;
  outputPath: string;
};

export type HarnessResolvedTarget = {
  definition: HarnessTargetDefinition;
  outputPath: string;
  parentRoot: string;
  root: string;
};

export function normalizeHarnessTargetOutputPath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

export function formatHarnessTargetReference(
  target: HarnessTargetDefinition
): string {
  return target.parent ? `${target.parent} -> ${target.path}` : target.path;
}

export function harnessTargetKey(target: HarnessTargetDefinition): string {
  return `${target.parent ?? ""}\0${target.path}`;
}

export function resolveHarnessTargetParentPath(
  root: string,
  target: HarnessTargetDefinition
): string {
  const parent = target.parent ?? ".";
  return path.isAbsolute(parent)
    ? path.resolve(parent)
    : path.resolve(root, parent);
}

export function resolveHarnessTargetParentPaths(
  root: string,
  target: HarnessTargetDefinition
): string[] {
  const parent = target.parent ?? ".";
  const resolvedParentPattern = path.isAbsolute(parent)
    ? path.resolve(parent)
    : path.resolve(root, parent);
  if (!usesHarnessPathPatternSyntax(parent)) {
    return [resolvedParentPattern];
  }
  return expandAbsoluteDirectoryPattern(resolvedParentPattern);
}

export function resolvedHarnessTargetParentValue(
  root: string,
  target: HarnessTargetDefinition,
  parentRoot: string
): string | undefined {
  if (target.parent === undefined) {
    return undefined;
  }
  if (path.isAbsolute(target.parent)) {
    return parentRoot;
  }
  return toRepoRelative(path.resolve(root), parentRoot) || ".";
}

export function resolveHarnessTargetInstances(
  root: string,
  target: HarnessTargetDefinition,
  label = `Target "${formatHarnessTargetReference(target)}"`
): HarnessResolvedTarget[] {
  if (hasHarnessPathPattern(target.path)) {
    throw new Error(`${label} path must be static and cannot use wildcards.`);
  }

  const parentRoots = resolveHarnessTargetParentPaths(root, target);
  return parentRoots.map((parentRoot) => {
    const targetRoot = path.resolve(parentRoot, target.path);
    const relativeToParent = path.relative(parentRoot, targetRoot);
    if (
      !relativeToParent ||
      relativeToParent.startsWith("..") ||
      path.isAbsolute(relativeToParent)
    ) {
      throw new Error(
        `${label} path must stay inside its declared parent: ${
          path.relative(process.cwd(), targetRoot) || targetRoot
        }`
      );
    }

    const outputPath = normalizeHarnessTargetOutputPath(target.path);
    const resolvedTargetRoot =
      target.parent === undefined
        ? assertRepoLocalPath(root, targetRoot, label)
        : targetRoot;
    const parent = resolvedHarnessTargetParentValue(root, target, parentRoot);
    return {
      definition:
        parent === undefined
          ? { path: target.path }
          : { parent, path: target.path },
      outputPath,
      parentRoot,
      root: resolvedTargetRoot,
    };
  });
}

export function resolveHarnessTargetRoot(
  root: string,
  target: HarnessTargetDefinition,
  label = `Target "${formatHarnessTargetReference(target)}"`
): string {
  const targets = resolveHarnessTargetInstances(root, target, label);
  if (targets.length !== 1) {
    throw new Error(
      `${label} parent pattern must resolve to exactly one target parent.`
    );
  }
  return targets[0].root;
}

export function harnessTargetRootMappingsForConfig(
  root: string,
  config: { targets: HarnessTargetDefinition[] }
): HarnessTargetRootMapping[] {
  return config.targets.flatMap((target) =>
    resolveHarnessTargetInstances(root, target).map((resolvedTarget) => ({
      root: resolvedTarget.root,
      outputPath: resolvedTarget.outputPath,
    }))
  );
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    !relative || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function logicalTargetOutputPathForPhysicalPath(
  root: string,
  absolutePath: string,
  targetMappings: HarnessTargetRootMapping[]
): string {
  const mapping = targetMappings
    .filter((candidate) => isInsideOrEqual(candidate.root, absolutePath))
    .toSorted(
      (left, right) =>
        path.resolve(right.root).length - path.resolve(left.root).length
    )[0];
  if (!mapping) {
    return toRepoRelative(root, absolutePath);
  }
  const relative = normalizeHarnessTargetOutputPath(
    path.relative(mapping.root, absolutePath)
  );
  const targetOutputPath = normalizeHarnessTargetOutputPath(mapping.outputPath);
  return relative ? `${targetOutputPath}/${relative}` : targetOutputPath;
}

export function toRepoRelative(root: string, absolutePath: string): string {
  const relative = path.relative(root, absolutePath);
  return relative.split(path.sep).join("/");
}
