import { lstat, readFile } from "node:fs/promises";

import {
  assertRepoLocalPath,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import {
  DEFAULT_HARNESS_TARGET_PATH,
  type HarnessConfig,
  formatHarnessConfigTomlError,
  safeParseHarnessConfigToml,
} from "./standard";
import type {
  HarnessDiagnostic,
  HarnessInspection,
  HarnessLiveSurface,
} from "./types";

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
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
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

  const targetPaths = new Set<string>([
    normalizeTargetPath(DEFAULT_HARNESS_TARGET_PATH),
  ]);
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
          overlappingTarget === ".agents"
            ? DEFAULT_HARNESS_TARGET_PATH
            : overlappingTarget
        }".`,
        path: `targets.${target.path}`,
        recommendation:
          "Declare only independent additional projection paths; .agents is always the default target.",
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

export async function inspectHarnessConfig(
  root = process.cwd()
): Promise<HarnessInspection> {
  const paths = resolveHarnessPaths(root);
  const diagnostics: HarnessDiagnostic[] = [];
  const hasHarnessDir = await isDirectory(paths.harnessDir);
  const hasHarnessConfig = await pathExists(paths.configPath);
  const hasHarnessIgnore = await isFile(paths.ignorePath);
  const relativeHarnessDir = toRepoRelative(paths.root, paths.harnessDir);
  const relativeConfigPath = toRepoRelative(paths.root, paths.configPath);
  const relativeIgnorePath = toRepoRelative(paths.root, paths.ignorePath);
  const liveSurfaces: HarnessLiveSurface[] = [
    {
      id: "agents.skills",
      path: ".agents/skills",
      exists: await isDirectory(paths.agentsSkillsDir),
    },
    {
      id: "claude.skills",
      path: ".claude/skills",
      exists: await isDirectory(paths.claudeSkillsDir),
    },
    {
      id: "gemini.skills",
      path: ".gemini/skills",
      exists: await isDirectory(paths.geminiSkillsDir),
    },
    {
      id: "cursor.skills",
      path: ".cursor/skills",
      exists: await isDirectory(paths.cursorSkillsDir),
    },
  ];

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
      recommendation: "Run harnessc plan, then harnessc transition --yes.",
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
        "Replace it with a repo-root .harnessIgnore file before projecting resources.",
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
    const raw = await readFile(paths.configPath, "utf8");
    const result = safeParseHarnessConfigToml(raw);
    if (!result.success) {
      diagnostics.push({
        severity: "error",
        code: "harness.config_invalid",
        message: formatHarnessConfigTomlError(result.error),
        path: relativeConfigPath,
        recommendation: "Update harness.toml to a supported schema version.",
      });
    } else {
      validateConfigSemantics(result.data, paths.root, diagnostics);
    }
  }

  for (const surface of liveSurfaces.filter((surface) => surface.exists)) {
    diagnostics.push({
      severity: "info",
      code: "harness.live_surface_present",
      message: `${surface.path} is present and should be treated as a live harness surface.`,
      path: surface.path,
      recommendation:
        "Keep durable source definitions in .harness and project them into live surfaces explicitly.",
    });
  }

  return {
    root: paths.root,
    paths,
    hasHarnessDir,
    hasHarnessConfig,
    hasHarnessIgnore,
    liveSurfaces,
    diagnostics,
  };
}

export async function validateHarnessConfig(
  root = process.cwd()
): Promise<HarnessInspection> {
  return inspectHarnessConfig(root);
}
