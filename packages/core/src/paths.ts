import path from "node:path";

import type { ConventionalHarnessResource, HarnessConfigPaths } from "./types";

export const HARNESS_CONFIG_DIR = ".harness";
export const HARNESS_CONFIG_FILE = "harness.toml";
export const HARNESS_IGNORE_FILE = ".harnessIgnore";
export const HARNESS_STATE_DIR = ".state";
export const HARNESS_MANIFEST_FILE = "projection-manifest.json";
export const CONVENTIONAL_HARNESS_RESOURCES = [
  "skills",
  "rules",
  "plugins",
] as const satisfies readonly ConventionalHarnessResource[];

export function resolveHarnessPaths(root = process.cwd()): HarnessConfigPaths {
  const absoluteRoot = path.resolve(root);
  const harnessDir = path.join(absoluteRoot, HARNESS_CONFIG_DIR);
  const stateDir = path.join(harnessDir, HARNESS_STATE_DIR);

  return {
    root: absoluteRoot,
    harnessDir,
    configPath: path.join(harnessDir, HARNESS_CONFIG_FILE),
    ignorePath: path.join(absoluteRoot, HARNESS_IGNORE_FILE),
    skillsDir: path.join(harnessDir, "skills"),
    rulesDir: path.join(harnessDir, "rules"),
    pluginsDir: path.join(harnessDir, "plugins"),
    workspaceReadmePath: path.join(harnessDir, "README.md"),
    stateDir,
    manifestPath: path.join(stateDir, HARNESS_MANIFEST_FILE),
  };
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
