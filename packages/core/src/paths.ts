import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_HARNESS_CONFIG_PATH,
  DEFAULT_HARNESS_DIR_PATH,
  DEFAULT_HARNESS_RESOURCES_PATH,
} from "./standard";
import type {
  ConventionalHarnessResource,
  HarnessConfigPaths,
  HarnessPathOptions,
} from "./types";

export const HARNESS_CONFIG_DIR = ".harness";
export const HARNESS_CONFIG_FILE = "harness.toml";
export const HARNESS_RESOURCES_DIR = "resources";
export const HARNESS_IGNORE_FILE = ".harnessIgnore";
export const HARNESS_PROFILE_FILE = ".harnessProfile";
export const HARNESS_PROFILE_ROOT_FILE = ".harnessProfileRoot";
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
  const resourcesDirs = (options.config?.resources ?? []).map((source) =>
    resolveRepoLocalPath(
      absoluteRoot,
      source.path,
      `Resources source path "${source.path}"`
    )
  );
  const dirDirs = (options.config?.dir ?? []).map((source) =>
    resolveRepoLocalPath(
      absoluteRoot,
      source.path,
      `Dir source path "${source.path}"`
    )
  );
  const resourcesDir =
    resourcesDirs[0] ??
    resolveRepoLocalPath(
      absoluteRoot,
      DEFAULT_HARNESS_RESOURCES_PATH,
      "Resources source path"
    );

  return {
    root: absoluteRoot,
    harnessDir,
    configPath,
    ignorePath: path.join(absoluteRoot, HARNESS_IGNORE_FILE),
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
  if (!normalizedPath.endsWith(`/${HARNESS_IGNORE_FILE}`)) {
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

export function toRepoRelative(root: string, absolutePath: string): string {
  const relative = path.relative(root, absolutePath);
  return relative.split(path.sep).join("/");
}
