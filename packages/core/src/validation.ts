import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { planHarnessDir } from "./dir";
import { loadHarnessIgnoreRuleSets } from "./ignore";
import {
  loadHarnessProfileContext,
  type HarnessProfileContext,
} from "./profile";
import {
  HARNESS_PROFILE_ROOT_FILE,
  assertRepoLocalPath,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import {
  type HarnessConfig,
  formatHarnessConfigTomlError,
  safeParseHarnessConfigToml,
} from "./standard";
import type { HarnessDiagnostic, HarnessInspection } from "./types";

export type HarnessValidationOptions = {
  config?: HarnessConfig;
  profileContext?: HarnessProfileContext;
};

async function isDirectory(path: string): Promise<boolean> {
  const pathStat = await lstat(path).catch(() => undefined);
  return Boolean(pathStat?.isDirectory());
}

async function isFile(path: string): Promise<boolean> {
  const pathStat = await lstat(path).catch(() => undefined);
  return Boolean(pathStat?.isFile());
}

async function pathExists(path: string): Promise<boolean> {
  return Boolean(await lstat(path).catch(() => undefined));
}

async function findProfileRootsOutsideHarness(
  root: string,
  harnessDir: string
): Promise<string[]> {
  const markers: string[] = [];
  const ignoredDirectories = new Set([".git", "node_modules"]);

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      () => []
    );
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (path.resolve(absolutePath) === path.resolve(harnessDir)) {
        continue;
      }
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          continue;
        }
        await visit(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name === HARNESS_PROFILE_ROOT_FILE) {
        markers.push(absolutePath);
      }
    }
  }

  await visit(root);
  return markers.toSorted((left, right) => left.localeCompare(right));
}

function validateRepoLocalPath(
  diagnostics: HarnessDiagnostic[],
  root: string,
  relativePath: string,
  diagnosticPath: string,
  label: string
): void {
  try {
    assertRepoLocalPath(
      root,
      resolveRepoLocalPath(root, relativePath, label),
      label
    );
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "harness.path_not_repo_local",
      message: error instanceof Error ? error.message : String(error),
      path: diagnosticPath,
      recommendation: "Use a relative path that stays inside this repository.",
    });
  }
}

function normalizeTargetPath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

function targetPathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function validateConfigSemantics(
  config: HarnessConfig,
  root: string,
  diagnostics: HarnessDiagnostic[]
): void {
  for (const [resource, definition] of Object.entries(config.resources)) {
    validateRepoLocalPath(
      diagnostics,
      root,
      definition.path,
      `resources.${resource}.path`,
      `Resource "${resource}" path`
    );
  }

  const targetPaths = new Set<string>();
  for (const target of config.targets) {
    const normalizedTargetPath = normalizeTargetPath(target.path);
    const overlappingTarget = [...targetPaths].find((existingPath) =>
      targetPathsOverlap(normalizedTargetPath, existingPath)
    );
    if (overlappingTarget) {
      diagnostics.push({
        severity: "error",
        code:
          normalizedTargetPath === overlappingTarget
            ? "harness.target_duplicate_path"
            : "harness.target_overlapping_path",
        message: `Target path "${target.path}" overlaps with "${
          overlappingTarget
        }".`,
        path: `targets.${target.path}`,
        recommendation:
          "Declare only independent projection paths. Each target is explicit.",
      });
    }
    targetPaths.add(normalizedTargetPath);
    validateRepoLocalPath(
      diagnostics,
      root,
      target.path,
      `targets.${target.path}.path`,
      `Target "${target.path}" output path`
    );
  }
}

async function validateTargetSymlinks(
  config: HarnessConfig,
  root: string,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  for (const target of config.targets) {
    const targetRoot = resolveRepoLocalPath(
      root,
      target.path,
      `Target "${target.path}" output path`
    );
    const state = await lstat(targetRoot).catch(() => undefined);
    if (!state) {
      continue;
    }
    if (state.isSymbolicLink()) {
      diagnostics.push({
        severity: "error",
        code: "harness.target_symlink_unsupported",
        message:
          "Declared target paths must be real directories, not symlinks.",
        path: toRepoRelative(root, targetRoot),
        recommendation:
          "Replace the symlink with a real directory before activating HarnessConfig.",
      });
      continue;
    }
    if (!state.isDirectory()) {
      continue;
    }
    await validateNestedTargetSymlinks(root, targetRoot, diagnostics);
  }
}

async function validateNestedTargetSymlinks(
  root: string,
  directory: string,
  diagnostics: HarnessDiagnostic[]
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => []
  );
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      diagnostics.push({
        severity: "error",
        code: "harness.target_symlink_unsupported",
        message:
          "Declared target trees must not contain symlinks. HarnessConfig v1 does not follow or replace nested target symlinks.",
        path: toRepoRelative(root, absolutePath),
        recommendation:
          "Replace the symlink with a regular file or directory before activating HarnessConfig.",
      });
      continue;
    }
    if (entry.isDirectory()) {
      await validateNestedTargetSymlinks(root, absolutePath, diagnostics);
    }
  }
}

function diagnosticKey(diagnostic: HarnessDiagnostic): string {
  return [
    diagnostic.severity,
    diagnostic.code,
    diagnostic.path ?? "",
    diagnostic.message,
  ].join("\0");
}

function dedupeDiagnostics(
  diagnostics: HarnessDiagnostic[]
): HarnessDiagnostic[] {
  const seen = new Set<string>();
  const output: HarnessDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(diagnostic);
  }
  return output;
}

export async function inspectHarnessConfig(
  root = process.cwd(),
  options: HarnessValidationOptions = {}
): Promise<HarnessInspection> {
  const paths = resolveHarnessPaths(root);
  const diagnostics: HarnessDiagnostic[] = [];
  const hasHarnessDir = await isDirectory(paths.harnessDir);
  const hasHarnessConfig = await pathExists(paths.configPath);
  const hasHarnessIgnore = await isFile(paths.ignorePath);
  const relativeHarnessDir = toRepoRelative(paths.root, paths.harnessDir);
  const relativeConfigPath = toRepoRelative(paths.root, paths.configPath);
  const relativeIgnorePath = toRepoRelative(paths.root, paths.ignorePath);
  if ((await pathExists(paths.harnessDir)) && !hasHarnessDir) {
    diagnostics.push({
      severity: "error",
      code: "harness.root_not_directory",
      message: `${relativeHarnessDir} exists but is not a directory.`,
      path: relativeHarnessDir,
      recommendation: "Replace it with a directory before using HarnessConfig.",
    });
  }

  if (!hasHarnessDir) {
    diagnostics.push({
      severity: "warning",
      code: "harness.root_missing",
      message: `${relativeHarnessDir} does not exist.`,
      path: relativeHarnessDir,
      recommendation: "Run harnessc plan, then harnessc init --yes.",
    });
  }

  if (hasHarnessDir && !hasHarnessConfig) {
    diagnostics.push({
      severity: "warning",
      code: "harness.config_missing",
      message: `${relativeConfigPath} is missing.`,
      path: relativeConfigPath,
      recommendation: "Create a versioned harness.toml manifest.",
    });
  }

  if ((await pathExists(paths.ignorePath)) && !hasHarnessIgnore) {
    diagnostics.push({
      severity: "error",
      code: "harness.ignore_not_file",
      message: `${relativeIgnorePath} exists but is not a file.`,
      path: relativeIgnorePath,
      recommendation:
        "Replace it with a regular .harnessIgnore file before projecting resources.",
    });
  }

  if (hasHarnessDir && !(await pathExists(paths.ignorePath))) {
    diagnostics.push({
      severity: "warning",
      code: "harness.ignore_missing",
      message: `${relativeIgnorePath} is missing.`,
      path: relativeIgnorePath,
      recommendation:
        "Create .harnessIgnore to define source-only files skipped during live projection.",
    });
  }

  for (const markerPath of await findProfileRootsOutsideHarness(
    paths.root,
    paths.harnessDir
  )) {
    diagnostics.push({
      severity: "error",
      code: "harness.profile_root_outside_harness",
      message: ".harnessProfileRoot may only exist under .harness.",
      path: toRepoRelative(paths.root, markerPath),
      recommendation:
        "Move the profile root under .harness, or rename this file if it is not a HarnessConfig declaration.",
    });
  }

  if (hasHarnessConfig) {
    let config = options.config;
    if (!config) {
      const raw = await readFile(paths.configPath, "utf8");
      const result = safeParseHarnessConfigToml(raw);
      if (result.success) {
        config = result.data;
      } else {
        diagnostics.push({
          severity: "error",
          code: "harness.config_invalid",
          message: formatHarnessConfigTomlError(result.error),
          path: relativeConfigPath,
          recommendation: "Update harness.toml to a supported schema version.",
        });
      }
    }

    if (config) {
      validateConfigSemantics(config, paths.root, diagnostics);
      await validateTargetSymlinks(config, paths.root, diagnostics);
      const profileContext =
        options.profileContext ??
        (await loadHarnessProfileContext(paths.root, {
          config,
        }));
      diagnostics.push(...profileContext.diagnostics);
      const { diagnostics: ignoreDiagnostics } =
        await loadHarnessIgnoreRuleSets(paths.root, { config });
      diagnostics.push(...ignoreDiagnostics);
      const dirPlan = await planHarnessDir(paths.root, config, {
        profileContext,
      });
      diagnostics.push(...dirPlan.diagnostics);
    } else {
      const { diagnostics: ignoreDiagnostics } =
        await loadHarnessIgnoreRuleSets(paths.root);
      diagnostics.push(...ignoreDiagnostics);
    }
  } else {
    const { diagnostics: ignoreDiagnostics } = await loadHarnessIgnoreRuleSets(
      paths.root
    );
    diagnostics.push(...ignoreDiagnostics);
  }

  return {
    root: paths.root,
    paths,
    hasHarnessDir,
    hasHarnessConfig,
    hasHarnessIgnore,
    diagnostics: dedupeDiagnostics(diagnostics),
  };
}

export async function validateHarnessConfig(
  root = process.cwd(),
  options: HarnessValidationOptions = {}
): Promise<HarnessInspection> {
  return inspectHarnessConfig(root, options);
}
