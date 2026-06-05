import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "smol-toml";

import { planHarnessDir } from "./dir";
import { loadHarnessIgnoreRuleSets } from "./ignore";
import {
  loadHarnessProfileContext,
  type HarnessProfileContext,
} from "./profile";
import {
  HARNESS_PROFILE_ROOT_FILE,
  assertRepoLocalPath,
  formatHarnessTargetReference,
  resolveHarnessPaths,
  resolveHarnessTargetInstances,
  resolveRepoLocalDirectoryPattern,
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
  const ignoredDirectories = new Set([
    ".git",
    ".hg",
    ".svn",
    ".jj",
    ".idea",
    ".vscode",
    ".turbo",
    ".next",
    ".nuxt",
    ".cache",
    ".pnpm-store",
    "node_modules",
    "bower_components",
    "vendor",
    "dist",
    "build",
    "out",
    "target",
    "coverage",
    "__pycache__",
  ]);
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

function pathsOverlap(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  const leftFromRight = path.relative(resolvedRight, resolvedLeft);
  const rightFromLeft = path.relative(resolvedLeft, resolvedRight);
  return (
    !leftFromRight ||
    !rightFromLeft ||
    (!leftFromRight.startsWith("..") && !path.isAbsolute(leftFromRight)) ||
    (!rightFromLeft.startsWith("..") && !path.isAbsolute(rightFromLeft))
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
  const sourceRoots: Array<{ label: string; path: string; root: string }> = [];
  for (const source of sourcePaths) {
    validateRepoLocalPath(
      diagnostics,
      root,
      source.path,
      `${source.label}.path`,
      `${source.label} source path`
    );
    const resolvedSourceRoots = (() => {
      try {
        return resolveRepoLocalDirectoryPattern(
          root,
          source.path,
          `${source.label} source path`
        );
      } catch {
        return [];
      }
    })();
    for (const sourceRoot of resolvedSourceRoots) {
      sourceRoots.push({ ...source, root: sourceRoot });
    }
  }
  for (let leftIndex = 0; leftIndex < sourceRoots.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sourceRoots.length;
      rightIndex += 1
    ) {
      const left = sourceRoots[leftIndex];
      const right = sourceRoots[rightIndex];
      if (pathsOverlap(left.root, right.root)) {
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

  const targetRoots: Array<{ reference: string; root: string }> = [];
  const harnessDir = resolveHarnessPaths(root, { config }).harnessDir;
  for (const target of config.targets) {
    const targetReference = formatHarnessTargetReference(target);
    let resolvedTargets: ReturnType<typeof resolveHarnessTargetInstances>;
    try {
      resolvedTargets = resolveHarnessTargetInstances(
        root,
        target,
        `Target "${targetReference}" output path`
      );
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code: "harness.target_path_invalid",
        message: error instanceof Error ? error.message : String(error),
        path: `targets["${targetReference}"].path`,
        recommendation:
          "Use a target path that stays inside its declared parent.",
      });
      continue;
    }
    for (const resolvedTarget of resolvedTargets) {
      const targetRoot = resolvedTarget.root;
      const resolvedReference = formatHarnessTargetReference(
        resolvedTarget.definition
      );
      if (path.resolve(targetRoot) === path.resolve(root)) {
        diagnostics.push({
          severity: "error",
          code: "harness.target_repo_root",
          message: `Target "${resolvedReference}" resolves to the repository root.`,
          path: `targets["${targetReference}"].path`,
          recommendation:
            "Declare a target folder below the repository root or below an explicit parent.",
        });
      }
      if (pathsOverlap(targetRoot, harnessDir)) {
        diagnostics.push({
          severity: "error",
          code: "harness.target_overlaps_source_path",
          message: `Target "${resolvedReference}" overlaps with the .harness source root.`,
          path: `targets["${targetReference}"].path`,
          recommendation:
            "Projection targets must be separate from Harness config source roots.",
        });
      }
      for (const source of sourceRoots) {
        if (pathsOverlap(targetRoot, source.root)) {
          diagnostics.push({
            severity: "error",
            code: "harness.target_overlaps_source_path",
            message: `Target "${resolvedReference}" overlaps with ${source.label} source path "${source.path}".`,
            path: `targets["${targetReference}"].path`,
            recommendation:
              "Projection targets must be separate from configured source roots.",
          });
        }
      }
      const overlappingTarget = targetRoots.find((existing) =>
        pathsOverlap(targetRoot, existing.root)
      );
      if (overlappingTarget) {
        diagnostics.push({
          severity: "error",
          code:
            path.resolve(targetRoot) === path.resolve(overlappingTarget.root)
              ? "harness.target_duplicate_path"
              : "harness.target_overlapping_path",
          message: `Target "${resolvedReference}" overlaps with "${overlappingTarget.reference}".`,
          path: `targets["${targetReference}"]`,
          recommendation:
            "Declare only independent projection paths. Each target is explicit.",
        });
      }
      targetRoots.push({ reference: resolvedReference, root: targetRoot });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pushUnknownManifestFieldDiagnostic(
  diagnostics: HarnessDiagnostic[],
  fieldPath: string
): void {
  diagnostics.push({
    severity: "info",
    code: "harness.manifest_unknown_field",
    message: `Manifest field "${fieldPath}" is not defined by Harness config v1 and will be ignored by this tool.`,
    path: fieldPath,
    recommendation:
      "Keep the field only if it is intended for newer tooling or an extension.",
  });
}

function reportUnknownKeys(
  diagnostics: HarnessDiagnostic[],
  record: Record<string, unknown>,
  knownKeys: Set<string>,
  pathPrefix = ""
): void {
  for (const key of Object.keys(record)) {
    if (knownKeys.has(key)) {
      continue;
    }
    pushUnknownManifestFieldDiagnostic(
      diagnostics,
      pathPrefix ? `${pathPrefix}.${key}` : key
    );
  }
}

function reportUnknownEntryKeys(
  diagnostics: HarnessDiagnostic[],
  parsed: Record<string, unknown>,
  key: "resources" | "targets" | "dir"
): void {
  const entries = parsed[key];
  if (!Array.isArray(entries)) {
    return;
  }
  for (const [index, entry] of entries.entries()) {
    if (!isRecord(entry)) {
      continue;
    }
    reportUnknownKeys(
      diagnostics,
      entry,
      new Set(key === "targets" ? ["path", "parent"] : ["path"]),
      `${key}[${index}]`
    );
  }
}

function reportUnknownManifestFields(
  diagnostics: HarnessDiagnostic[],
  parsed: unknown
): void {
  if (!isRecord(parsed)) {
    return;
  }
  reportUnknownKeys(
    diagnostics,
    parsed,
    new Set([
      "version",
      "activation",
      "resources",
      "targets",
      "dir",
      "extensions",
    ])
  );
  reportUnknownEntryKeys(diagnostics, parsed, "resources");
  reportUnknownEntryKeys(diagnostics, parsed, "targets");
  reportUnknownEntryKeys(diagnostics, parsed, "dir");
  if (isRecord(parsed.activation)) {
    reportUnknownKeys(
      diagnostics,
      parsed.activation,
      new Set(["targetSymlinks"]),
      "activation"
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

export async function validateHarnessConfig(
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
        reportUnknownManifestFields(diagnostics, parse(raw));
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
