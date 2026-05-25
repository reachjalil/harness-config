import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import type { ConventionalHarnessResource, HarnessConfigPaths } from "./types";

export const HARNESS_CONFIG_DIR = ".harness";
export const HARNESS_CONFIG_FILE = "harness.toml";
export const HARNESS_IGNORE_FILE = ".harnessIgnore";
export const HARNESS_PROFILE_FILE = ".harnessProfile";
export const HARNESS_PROFILE_ROOT_FILE = ".harnessProfileRoot";
export const CONVENTIONAL_HARNESS_RESOURCES = [
  "skills",
  "rules",
  "plugins",
] as const satisfies readonly ConventionalHarnessResource[];

export function resolveHarnessPaths(root = process.cwd()): HarnessConfigPaths {
  const absoluteRoot = path.resolve(root);
  const harnessDir = path.join(absoluteRoot, HARNESS_CONFIG_DIR);

  return {
    root: absoluteRoot,
    harnessDir,
    configPath: path.join(harnessDir, HARNESS_CONFIG_FILE),
    ignorePath: path.join(absoluteRoot, HARNESS_IGNORE_FILE),
    skillsDir: path.join(harnessDir, "skills"),
    rulesDir: path.join(harnessDir, "rules"),
    pluginsDir: path.join(harnessDir, "plugins"),
    workspaceReadmePath: path.join(harnessDir, "README.md"),
  };
}

export async function findHarnessIgnoreFiles(
  root = process.cwd()
): Promise<string[]> {
  const paths = resolveHarnessPaths(root);
  const files: string[] = [];
  const rootIgnoreState = await lstat(paths.ignorePath).catch(() => undefined);
  if (rootIgnoreState?.isFile()) {
    files.push(paths.ignorePath);
  }

  const harnessDirState = await lstat(paths.harnessDir).catch(() => undefined);
  if (!harnessDirState?.isDirectory() || harnessDirState.isSymbolicLink()) {
    return files;
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

  await visit(paths.harnessDir);
  return files;
}

export function detectImplicitOverrideTarget(
  repoRelativePath: string
): string | undefined {
  const segments = repoRelativePath
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .split("/")
    .filter(Boolean);
  if (
    segments.length < 5 ||
    segments[0] !== HARNESS_CONFIG_DIR ||
    segments.at(-1) !== HARNESS_IGNORE_FILE
  ) {
    return undefined;
  }

  const overrideSegment = segments[3];
  if (!overrideSegment?.startsWith(".")) {
    return undefined;
  }

  return overrideSegment;
}

export function defaultHarnessResourcePath(
  resource: ConventionalHarnessResource | string
): string {
  return `./.harness/${resource}`;
}

export function resolveHarnessResourceDir(
  root: string,
  resource: string
): string {
  return path.join(path.resolve(root), HARNESS_CONFIG_DIR, resource);
}

export function resolveHarnessResourceItemDir(
  root: string,
  resource: string,
  name: string
): string {
  return path.join(resolveHarnessResourceDir(root, resource), name);
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
