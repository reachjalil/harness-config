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
  configPath?: string;
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

async function findProfileRootsOutsideAllowedRoots(
  root: string,
  allowedRoots: string[]
): Promise<string[]> {
  const markers: string[] = [];
  const ignoredDirectories = new Set([".git", "node_modules"]);
  const resolvedAllowedRoots = allowedRoots.map((allowedRoot) =>
    path.resolve(allowedRoot)
  );

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      () => []
    );
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (
        entry.isDirectory() &&
        resolvedAllowedRoots.some(
          (allowedRoot) => path.resolve(absolutePath) === allowedRoot
        )
      ) {
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

function profileRootAllowedRoots(
  root: string,
  config: HarnessConfig
): string[] {
  const paths = resolveHarnessPaths(root, { config });
  return [paths.harnessDir, ...paths.resourcesDirs, ...paths.dirDirs];
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
  const sourcePaths = [
    ...config.resources.map((source, index) => ({
      label: `resources[${index}]`,
      path: source.path,
    })),
    ...config.dir.map((source, index) => ({
      label: `dir[${index}]`,
      path: source.path,
    })),
  ];
  for (const source of sourcePaths) {
    validateRepoLocalPath(
      diagnostics,
      root,
      source.path,
      `${source.label}.path`,
      `${source.label} source path`
    );
  }
  for (let leftIndex = 0; leftIndex < sourcePaths.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sourcePaths.length;
      rightIndex += 1
    ) {
      const left = sourcePaths[leftIndex];
      const right = sourcePaths[rightIndex];
      const normalizedLeft = normalizeTargetPath(left.path);
      const normalizedRight = normalizeTargetPath(right.path);
      if (targetPathsOverlap(normalizedLeft, normalizedRight)) {
        diagnostics.push({
          severity: "error",
          code: "harness.source_path_overlapping",
          message: `${left.label} path "${left.path}" overlaps with ${right.label} path "${right.path}".`,
          path: `${left.label}.path`,
          recommendation:
            "Use independent source roots for resources and dir composition.",
        });
      }
    }
  }

  const targetPaths = new Set<string>();
  for (const target of config.targets) {
    const normalizedTargetPath = normalizeTargetPath(target.path);
    for (const source of sourcePaths) {
      const normalizedSourcePath = normalizeTargetPath(source.path);
      if (targetPathsOverlap(normalizedTargetPath, normalizedSourcePath)) {
        diagnostics.push({
          severity: "error",
          code: "harness.target_overlaps_source_path",
          message: `Target path "${target.path}" overlaps with ${source.label} source path "${source.path}".`,
          path: `targets["${target.path}"].path`,
          recommendation:
            "Projection targets must be separate from configured source roots.",
        });
      }
    }
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
        path: `targets["${target.path}"]`,
        recommendation:
          "Declare only independent projection paths. Each target is explicit.",
      });
    }
    targetPaths.add(normalizedTargetPath);
    validateRepoLocalPath(
      diagnostics,
      root,
      target.path,
      `targets["${target.path}"].path`,
      `Target "${target.path}" output path`
    );
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
  let paths = resolveHarnessPaths(root, {
    config: options.config,
    configPath: options.configPath,
  });
  const diagnostics: HarnessDiagnostic[] = [];
  const hasHarnessDir = await isDirectory(paths.harnessDir);
  const hasHarnessConfig = await pathExists(paths.configPath);
  const hasHarnessIgnore = await isFile(paths.ignorePath);
  const hasHarnessMutable = await isFile(paths.mutablePath);
  const relativeHarnessDir = toRepoRelative(paths.root, paths.harnessDir);
  const relativeConfigPath = toRepoRelative(paths.root, paths.configPath);
  const relativeIgnorePath = toRepoRelative(paths.root, paths.ignorePath);
  const relativeMutablePath = toRepoRelative(paths.root, paths.mutablePath);
  if ((await pathExists(paths.harnessDir)) && !hasHarnessDir) {
    diagnostics.push({
      severity: "error",
      code: "harness.root_not_directory",
      message: `${relativeHarnessDir} exists but is not a directory.`,
      path: relativeHarnessDir,
      recommendation:
        "Replace it with a directory before using Harness config.",
    });
  }

  if (!hasHarnessConfig) {
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

  if ((await pathExists(paths.mutablePath)) && !hasHarnessMutable) {
    diagnostics.push({
      severity: "error",
      code: "harness.mutable_not_file",
      message: `${relativeMutablePath} exists but is not a file.`,
      path: relativeMutablePath,
      recommendation:
        "Replace it with a regular .harnessMutable file before projecting mutable resources.",
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
      paths = resolveHarnessPaths(root, {
        config,
        configPath: options.configPath,
      });
      validateConfigSemantics(config, paths.root, diagnostics);
      for (const markerPath of await findProfileRootsOutsideAllowedRoots(
        paths.root,
        profileRootAllowedRoots(paths.root, config)
      )) {
        diagnostics.push({
          severity: "error",
          code: "harness.profile_root_outside_source_roots",
          message:
            ".harnessProfileRoot may only exist under the convention .harness folder, the configured resources path, or the configured dir path.",
          path: toRepoRelative(paths.root, markerPath),
          recommendation:
            "Move the profile root under a configured source root, or rename this file if it is not a Harness config declaration.",
        });
      }
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
    hasHarnessMutable,
    diagnostics: dedupeDiagnostics(diagnostics),
  };
}

export async function validateHarnessConfig(
  root = process.cwd(),
  options: HarnessValidationOptions = {}
): Promise<HarnessInspection> {
  return inspectHarnessConfig(root, options);
}
