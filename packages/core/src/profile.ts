import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "smol-toml";
import { z } from "zod";

import {
  createHarnessIgnoreMatcher,
  normalizeIgnorePath,
  parseHarnessIgnoreFile,
  parseHarnessMutableFile,
} from "./ignore";
import {
  detectImplicitOverrideTarget,
  HARNESS_IGNORE_FILE,
  HARNESS_MUTABLE_FILE,
  HARNESS_PROFILE_FILE,
  HARNESS_PROFILE_ISOLATION_FILE,
  HARNESS_PROFILE_ROOT_FILE,
  harnessTargetRootMappingsForConfig,
  logicalTargetOutputPathForPhysicalPath,
  resolveHarnessPaths,
  toRepoRelative,
  type HarnessTargetRootMapping,
} from "./paths";
import type { HarnessConfig } from "./standard";
import type { HarnessDiagnostic, HarnessIgnoreRuleSet } from "./types";

export type HarnessProfileRoot = {
  profile: string;
  rootDir: string;
  overlayBase: string;
  isolation?: HarnessProfileIsolation;
  markerPath: string;
};

export type HarnessProfileIsolation = {
  dir: string[];
  resources: string[];
  sourcePath: string;
};

type HarnessProfileSelector = {
  directory: string;
  profile?: string;
  sourcePath: string;
  index: number;
};

export type HarnessProfileContext = {
  diagnostics: HarnessDiagnostic[];
  ignoreRuleSets: HarnessIgnoreRuleSet[];
  profileRoots: HarnessProfileRoot[];
  protectedTargetPaths: string[];
  profileIsolatesDir(
    profile: string | undefined,
    relativePath: string,
    options?: { isDirectory?: boolean }
  ): boolean;
  profileIsolatesResources(
    profile: string | undefined,
    relativePath: string,
    options?: { isDirectory?: boolean }
  ): boolean;
  profileRootContainsPath(
    profile: string | undefined,
    absolutePath: string
  ): boolean;
  profileCanApplyWithin(
    outputPath: string | undefined,
    profile: string
  ): boolean;
  profileForOutput(outputPath?: string): string | undefined;
};

export type HarnessProfileContextOptions = {
  config?: HarnessConfig;
  sourceRoots?: string[];
  targetRootMappings?: HarnessTargetRootMapping[];
  targetRoots?: string[];
  targetOutputPaths?: string[];
};

export async function loadHarnessProfileContext(
  root = process.cwd(),
  options: HarnessProfileContextOptions = {}
): Promise<HarnessProfileContext> {
  const absoluteRoot = path.resolve(root);
  const diagnostics: HarnessDiagnostic[] = [];
  const profileRoots = await loadHarnessProfileRoots(
    absoluteRoot,
    profileOverlaySourceRoots(absoluteRoot, options),
    diagnostics,
    options.config
  );
  const { selectors, protectedTargetPaths } = await loadHarnessProfileSelectors(
    absoluteRoot,
    options,
    diagnostics
  );
  const { ruleSets, diagnostics: ignoreDiagnostics } =
    await loadProfileIgnoreRuleSets(absoluteRoot, profileRoots, options.config);
  diagnostics.push(...ignoreDiagnostics);

  const sortedSelectors = selectors.toSorted((left, right) => {
    const depthDifference =
      selectorDepth(left.directory) - selectorDepth(right.directory);
    if (depthDifference !== 0) {
      return depthDifference;
    }
    return left.index - right.index;
  });

  function profileForOutput(outputPath = ""): string | undefined {
    const normalized = normalizeIgnorePath(outputPath);
    let selected: string | undefined;
    for (const selector of sortedSelectors) {
      if (selectorParticipates(selector.directory, normalized)) {
        selected = selector.profile;
      }
    }
    return selected;
  }

  function profileCanApplyWithin(
    outputPath: string | undefined,
    profile: string
  ): boolean {
    const normalized = normalizeIgnorePath(outputPath ?? "");
    if (profileForOutput(normalized) === profile) {
      return true;
    }
    return sortedSelectors.some(
      (selector) =>
        selector.profile === profile &&
        selector.directory !== "" &&
        (normalized === "" ||
          selector.directory === normalized ||
          selector.directory.startsWith(`${normalized}/`))
    );
  }

  function profileIsolates(
    kind: "dir" | "resources",
    profile: string | undefined,
    relativePath: string,
    options: { isDirectory?: boolean } = {}
  ): boolean {
    if (!profile) {
      return false;
    }
    const normalized = normalizeIgnorePath(relativePath);
    if (!normalized) {
      return false;
    }
    return profileRoots.some((profileRoot) => {
      if (profileRoot.profile !== profile || !profileRoot.isolation) {
        return false;
      }
      const patterns = profileRoot.isolation[kind];
      if (patterns.length === 0) {
        return false;
      }
      return createIsolationMatcher(
        patterns,
        profileRoot.isolation.sourcePath
      ).ignores(normalized, { isDirectory: options.isDirectory });
    });
  }

  function profileRootContainsPath(
    profile: string | undefined,
    absolutePath: string
  ): boolean {
    if (!profile) {
      return false;
    }
    return profileRoots.some(
      (profileRoot) =>
        profileRoot.profile === profile &&
        isInsideOrEqual(profileRoot.rootDir, absolutePath)
    );
  }

  return {
    diagnostics,
    ignoreRuleSets: ruleSets,
    profileRoots,
    profileIsolatesDir: (profile, relativePath, options) =>
      profileIsolates("dir", profile, relativePath, options),
    profileIsolatesResources: (profile, relativePath, options) =>
      profileIsolates("resources", profile, relativePath, options),
    profileRootContainsPath,
    protectedTargetPaths,
    profileCanApplyWithin,
    profileForOutput,
  };
}

export function profileSourceDirForRoot(
  profileRoot: HarnessProfileRoot,
  logicalSourceRoot: string
): string | undefined {
  const relative = path.relative(
    path.resolve(profileRoot.overlayBase),
    path.resolve(logicalSourceRoot)
  );
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return path.join(profileRoot.rootDir, relative);
}

export function logicalPathForProfilePath(
  profileRoot: HarnessProfileRoot,
  absolutePath: string
): string {
  return path.join(
    profileRoot.overlayBase,
    path.relative(profileRoot.rootDir, absolutePath)
  );
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    !relative || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function profileOverlaySourceRoots(
  root: string,
  options: HarnessProfileContextOptions
): string[] {
  const paths = resolveHarnessPaths(root, { config: options.config });
  const roots = new Set<string>([
    paths.harnessDir,
    ...paths.resourcesDirs,
    ...paths.dirDirs,
  ]);

  for (const sourceRoot of options.sourceRoots ?? []) {
    roots.add(path.resolve(sourceRoot));
  }

  return [...roots];
}

async function loadHarnessProfileRoots(
  root: string,
  sourceRoots: string[],
  diagnostics: HarnessDiagnostic[],
  config?: HarnessConfig
): Promise<HarnessProfileRoot[]> {
  const paths = resolveHarnessPaths(root, { config });
  const markerPaths = [
    ...new Set(
      (
        await Promise.all(
          sourceRoots.map((sourceRoot) => findProfileRootMarkers(sourceRoot))
        )
      ).flat()
    ),
  ].toSorted((left, right) => left.localeCompare(right));
  const markerRootDirs = markerPaths.map((markerPath) =>
    path.dirname(markerPath)
  );
  const roots: HarnessProfileRoot[] = [];

  for (const markerPath of markerPaths) {
    const rootDir = path.dirname(markerPath);
    const nestedIn = markerRootDirs.find(
      (candidate) =>
        path.resolve(candidate) !== path.resolve(rootDir) &&
        isInsideOrEqual(candidate, rootDir)
    );
    if (nestedIn) {
      diagnostics.push({
        severity: "error",
        code: "harness.profile_nested_root",
        message:
          ".harnessProfileRoot cannot be nested inside another profile root.",
        path: toRepoRelative(root, markerPath),
        recommendation:
          "Move the nested profile root outside the parent profile root.",
      });
      continue;
    }

    const profile = await readProfileDeclaration(root, markerPath, {
      diagnostics,
      required: true,
      type: "root",
    });
    if (!profile) {
      continue;
    }
    const parent = path.dirname(rootDir);
    const sourceRoot = sourceRoots
      .filter(
        (candidate) =>
          path.resolve(candidate) !== path.resolve(paths.harnessDir)
      )
      .find((candidate) => isInsideOrEqual(candidate, rootDir));
    const overlaysLocalSource = Boolean(sourceRoot);
    const directSourceRoot = sourceRoots.find(
      (candidate) =>
        path.resolve(candidate) !== path.resolve(paths.harnessDir) &&
        path.resolve(candidate) === path.resolve(parent)
    );
    const isolation = await loadProfileIsolation(root, rootDir, diagnostics);
    roots.push({
      profile,
      rootDir,
      overlayBase:
        directSourceRoot ?? (overlaysLocalSource ? parent : paths.harnessDir),
      isolation,
      markerPath,
    });
  }

  return roots.toSorted((left, right) =>
    toRepoRelative(root, left.rootDir).localeCompare(
      toRepoRelative(root, right.rootDir)
    )
  );
}

const profileIsolationSchema = z
  .object({
    version: z.literal(1),
    isolate: z
      .object({
        dir: z.array(z.string().min(1)).default([]),
        resources: z.array(z.string().min(1)).default([]),
      })
      .default({ dir: [], resources: [] }),
  })
  .strict();

async function loadProfileIsolation(
  root: string,
  profileRootDir: string,
  diagnostics: HarnessDiagnostic[]
): Promise<HarnessProfileIsolation | undefined> {
  const isolationPath = path.join(
    profileRootDir,
    HARNESS_PROFILE_ISOLATION_FILE
  );
  const state = await lstat(isolationPath).catch(() => undefined);
  if (!state) {
    return undefined;
  }
  const sourcePath = toRepoRelative(root, isolationPath);
  if (!state.isFile()) {
    diagnostics.push({
      severity: "error",
      code: "harness.profile_isolation_not_file",
      message: ".harnessProfileIsolation must be a regular file.",
      path: sourcePath,
      recommendation:
        "Replace it with a UTF-8 TOML file or remove it from the profile root.",
    });
    return undefined;
  }

  const raw = await readFile(isolationPath, "utf8").catch((error: unknown) => {
    diagnostics.push({
      severity: "error",
      code: "harness.profile_isolation_read_failed",
      message: error instanceof Error ? error.message : String(error),
      path: sourcePath,
    });
    return undefined;
  });
  if (raw === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "harness.profile_isolation_invalid",
      message:
        error instanceof Error
          ? error.message
          : ".harnessProfileIsolation could not be parsed.",
      path: sourcePath,
      recommendation:
        "Use TOML with version = 1 and optional [isolate] resources/dir pattern arrays.",
    });
    return undefined;
  }

  const result = profileIsolationSchema.safeParse(parsed);
  if (!result.success) {
    diagnostics.push({
      severity: "error",
      code: "harness.profile_isolation_invalid",
      message: result.error.issues.map((issue) => issue.message).join("; "),
      path: sourcePath,
      recommendation:
        "Use TOML with version = 1 and optional [isolate] resources/dir pattern arrays.",
    });
    return undefined;
  }

  const resourcesRules = parseHarnessIgnoreFile(
    result.data.isolate.resources.join("\n"),
    { isRoot: true, sourcePath }
  );
  const dirRules = parseHarnessIgnoreFile(result.data.isolate.dir.join("\n"), {
    isRoot: true,
    sourcePath,
  });
  diagnostics.push(...resourcesRules.diagnostics, ...dirRules.diagnostics);

  return {
    dir: result.data.isolate.dir,
    resources: result.data.isolate.resources,
    sourcePath,
  };
}

function createIsolationMatcher(patterns: string[], sourcePath: string) {
  const parsed = parseHarnessIgnoreFile(patterns.join("\n"), {
    isRoot: true,
    sourcePath,
  });
  return createHarnessIgnoreMatcher(parsed.rules);
}

async function findProfileRootMarkers(harnessDir: string): Promise<string[]> {
  const state = await lstat(harnessDir).catch(() => undefined);
  if (!state?.isDirectory() || state.isSymbolicLink()) {
    return [];
  }

  const markers: string[] = [];
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
      if (entry.isFile() && entry.name === HARNESS_PROFILE_ROOT_FILE) {
        markers.push(absolutePath);
      }
    }
  }

  await visit(harnessDir);
  return markers.toSorted((left, right) => left.localeCompare(right));
}

async function loadHarnessProfileSelectors(
  root: string,
  options: HarnessProfileContextOptions,
  diagnostics: HarnessDiagnostic[]
): Promise<{
  protectedTargetPaths: string[];
  selectors: HarnessProfileSelector[];
}> {
  const selectorPaths = new Map<string, boolean>();
  await addProfileSelectorIfPresent(
    selectorPaths,
    path.join(root, HARNESS_PROFILE_FILE),
    true
  );

  const targetRootMappings = targetRootMappingsForOptions(root, options);
  const targetRoots = targetRootMappings.map((mapping) => mapping.root);
  for (const targetRoot of targetRoots) {
    await addNestedProfileSelectors(selectorPaths, targetRoot);
  }

  for (const outputPath of options.targetOutputPaths ?? []) {
    await addOutputAncestorProfileSelectors(selectorPaths, root, outputPath);
  }

  const selectors: HarnessProfileSelector[] = [];
  const protectedTargetPaths: string[] = [];
  for (const [index, [selectorPath, isRoot]] of [
    ...selectorPaths.entries(),
  ].entries()) {
    const profile = await readProfileDeclaration(root, selectorPath, {
      diagnostics,
      required: false,
      type: "selector",
    });
    const sourcePath = normalizeIgnorePath(
      isRoot
        ? toRepoRelative(root, selectorPath)
        : logicalTargetOutputPathForPhysicalPath(
            root,
            selectorPath,
            targetRootMappings
          )
    );
    selectors.push({
      directory: isRoot
        ? ""
        : normalizeIgnorePath(path.posix.dirname(sourcePath)),
      profile,
      sourcePath,
      index,
    });
    if (!isRoot) {
      protectedTargetPaths.push(sourcePath);
    }
  }

  return {
    protectedTargetPaths: protectedTargetPaths.toSorted((left, right) =>
      left.localeCompare(right)
    ),
    selectors,
  };
}

function targetRootMappingsForOptions(
  root: string,
  options: HarnessProfileContextOptions
): HarnessTargetRootMapping[] {
  const explicitMappings = [
    ...(options.targetRootMappings ?? []),
    ...(options.targetRoots ?? []).map((targetRoot) => ({
      root: path.resolve(targetRoot),
      outputPath: toRepoRelative(root, path.resolve(targetRoot)),
    })),
  ];
  const mappings = [
    ...explicitMappings,
    ...(explicitMappings.length === 0 && options.config
      ? harnessTargetRootMappingsForConfig(root, options.config)
      : []),
  ];
  const seen = new Set<string>();
  const output: HarnessTargetRootMapping[] = [];
  for (const mapping of mappings) {
    const key = `${path.resolve(mapping.root)}\0${mapping.outputPath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push({
      root: path.resolve(mapping.root),
      outputPath: mapping.outputPath,
    });
  }
  return output;
}

async function addNestedProfileSelectors(
  selectors: Map<string, boolean>,
  rootPath: string
): Promise<void> {
  const rootState = await lstat(rootPath).catch(() => undefined);
  if (!rootState?.isDirectory() || rootState.isSymbolicLink()) {
    return;
  }

  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true }).catch(
      () => []
    );
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      if (child.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (child.isFile() && child.name === HARNESS_PROFILE_FILE) {
        selectors.set(path.resolve(absolutePath), false);
      }
    }
  }

  await visit(rootPath);
}

async function addOutputAncestorProfileSelectors(
  selectors: Map<string, boolean>,
  root: string,
  outputPath: string
): Promise<void> {
  const normalized = normalizeIgnorePath(outputPath);
  const directories: string[] = [];
  let current = path.posix.dirname(normalized);
  while (current && current !== ".") {
    directories.push(current);
    current = path.posix.dirname(current);
  }

  for (const directory of directories.reverse()) {
    await addProfileSelectorIfPresent(
      selectors,
      path.join(root, directory, HARNESS_PROFILE_FILE),
      false
    );
  }
}

async function addProfileSelectorIfPresent(
  selectors: Map<string, boolean>,
  selectorPath: string,
  isRoot: boolean
): Promise<void> {
  const state = await lstat(selectorPath).catch(() => undefined);
  if (state?.isFile()) {
    selectors.set(path.resolve(selectorPath), isRoot);
  }
}

async function loadProfileIgnoreRuleSets(
  root: string,
  profileRoots: HarnessProfileRoot[],
  config?: HarnessConfig
): Promise<{
  diagnostics: HarnessDiagnostic[];
  ruleSets: HarnessIgnoreRuleSet[];
}> {
  const diagnostics: HarnessDiagnostic[] = [];
  const ruleSets: HarnessIgnoreRuleSet[] = [];
  const resourcesPaths = resolveHarnessPaths(root, {
    config,
  }).resourcesDirs.map((resourcesDir) => toRepoRelative(root, resourcesDir));

  for (const profileRoot of profileRoots) {
    const ruleFiles = [
      ...(
        await findNestedRuleFiles(profileRoot.rootDir, HARNESS_IGNORE_FILE)
      ).map((rulePath) => ({ kind: "ignore" as const, path: rulePath })),
      ...(
        await findNestedRuleFiles(profileRoot.rootDir, HARNESS_MUTABLE_FILE)
      ).map((rulePath) => ({ kind: "mutable" as const, path: rulePath })),
    ].toSorted((left, right) => left.path.localeCompare(right.path));
    for (const ruleFile of ruleFiles) {
      const raw = await readFile(ruleFile.path, "utf8").catch(() => undefined);
      if (raw === undefined) {
        continue;
      }
      const physicalSourcePath = normalizeIgnorePath(
        toRepoRelative(root, ruleFile.path)
      );
      const logicalIgnorePath = logicalPathForProfilePath(
        profileRoot,
        ruleFile.path
      );
      const logicalSourcePath = normalizeIgnorePath(
        toRepoRelative(root, logicalIgnorePath)
      );
      const parsed =
        ruleFile.kind === "mutable"
          ? parseHarnessMutableFile(raw, {
              isRoot: false,
              sourcePath: physicalSourcePath,
            })
          : parseHarnessIgnoreFile(raw, {
              isRoot: false,
              sourcePath: physicalSourcePath,
            });
      diagnostics.push(...parsed.diagnostics);
      ruleSets.push({
        rules: parsed.rules,
        directory: normalizeIgnorePath(path.posix.dirname(logicalSourcePath)),
        sourcePath: physicalSourcePath,
        isRoot: false,
        matchBase: "source",
        implicitTarget: resourcesPaths
          .map((resourcesPath) =>
            detectImplicitOverrideTarget(logicalSourcePath, {
              resourcesPath,
            })
          )
          .find(Boolean),
        profile: profileRoot.profile,
      });
    }
  }

  return { diagnostics, ruleSets };
}

async function findNestedRuleFiles(
  rootPath: string,
  fileName: string
): Promise<string[]> {
  const rootState = await lstat(rootPath).catch(() => undefined);
  if (!rootState?.isDirectory() || rootState.isSymbolicLink()) {
    return [];
  }

  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true }).catch(
      () => []
    );
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      if (child.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (child.isFile() && child.name === fileName) {
        files.push(path.resolve(absolutePath));
      }
    }
  }

  await visit(rootPath);
  return files.toSorted((left, right) => left.localeCompare(right));
}

async function readProfileDeclaration(
  root: string,
  declarationPath: string,
  options: {
    diagnostics: HarnessDiagnostic[];
    required: boolean;
    type: "root" | "selector";
  }
): Promise<string | undefined> {
  const raw = await readFile(declarationPath, "utf8").catch(
    (error: unknown) => {
      options.diagnostics.push({
        severity: options.required ? "error" : "warning",
        code: "harness.profile_read_failed",
        message: error instanceof Error ? error.message : String(error),
        path: toRepoRelative(root, declarationPath),
      });
      return undefined;
    }
  );
  if (raw === undefined) {
    return undefined;
  }

  const profileLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (profileLines.length === 0) {
    if (options.required) {
      options.diagnostics.push({
        severity: "error",
        code: "harness.profile_empty",
        message: ".harnessProfileRoot must contain a profile name.",
        path: toRepoRelative(root, declarationPath),
      });
    }
    return undefined;
  }

  if (profileLines.length > 1) {
    options.diagnostics.push({
      severity: "error",
      code: "harness.profile_invalid",
      message:
        options.type === "root"
          ? ".harnessProfileRoot must contain exactly one profile name."
          : ".harnessProfile must contain at most one profile name.",
      path: toRepoRelative(root, declarationPath),
    });
    return undefined;
  }

  return profileLines[0];
}

function selectorDepth(directory: string): number {
  if (!directory) {
    return 0;
  }
  return directory.split("/").filter(Boolean).length;
}

function selectorParticipates(directory: string, outputPath: string): boolean {
  return (
    directory === "" ||
    outputPath === directory ||
    outputPath.startsWith(`${directory}/`)
  );
}

export {
  HARNESS_PROFILE_FILE,
  HARNESS_PROFILE_ISOLATION_FILE,
  HARNESS_PROFILE_ROOT_FILE,
};
