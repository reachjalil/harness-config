import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  HARNESS_IGNORE_FILE,
  HARNESS_MUTABLE_FILE,
  HARNESS_PROFILE_FILE,
  HARNESS_PROFILE_ROOT_FILE,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import type { HarnessConfig } from "./standard";
import type {
  HarnessDiagnostic,
  HarnessIgnoreExplanation,
  HarnessIgnoreMatcher,
  HarnessIgnoreMatchBase,
  HarnessIgnoreRule,
  HarnessIgnoreRuleMatch,
  HarnessIgnoreRuleKind,
  HarnessIgnoreRuleSet,
} from "./types";

type SectionState = Pick<HarnessIgnoreRule, "kind" | "scope" | "target"> & {
  active: boolean;
};

type HarnessRuleFileKind = "ignore" | "mutable";

type HarnessRuleFileEntry = {
  kind: HarnessRuleFileKind;
  path: string;
  matchBase: HarnessIgnoreMatchBase;
};

type HarnessIgnoreDiscoveryOptions = {
  config?: HarnessConfig;
  extraRuleSets?: HarnessIgnoreRuleSet[];
  protectedTargetPaths?: string[];
  sourceRoots?: string[];
  targetRoots?: string[];
  targetOutputPaths?: string[];
};

export function parseHarnessIgnore(raw: string): HarnessIgnoreRule[] {
  return parseHarnessIgnoreLines(raw, {
    defaultKind: "ignore",
    isRoot: true,
    sourcePath: HARNESS_IGNORE_FILE,
  }).rules;
}

export function parseHarnessMutable(raw: string): HarnessIgnoreRule[] {
  return parseHarnessMutableFile(raw, {
    isRoot: true,
    sourcePath: HARNESS_MUTABLE_FILE,
  }).rules;
}

export function parseHarnessIgnoreFile(
  raw: string,
  options: {
    isRoot: boolean;
    sourcePath: string;
  }
): { rules: HarnessIgnoreRule[]; diagnostics: HarnessDiagnostic[] } {
  return parseHarnessIgnoreLines(raw, { ...options, defaultKind: "ignore" });
}

export function parseHarnessMutableFile(
  raw: string,
  options: {
    isRoot: boolean;
    sourcePath: string;
  }
): { rules: HarnessIgnoreRule[]; diagnostics: HarnessDiagnostic[] } {
  return parseHarnessIgnoreLines(raw, { ...options, defaultKind: "mutable" });
}

function parseHarnessIgnoreLines(
  raw: string,
  options: {
    defaultKind: HarnessIgnoreRuleKind;
    isRoot: boolean;
    sourcePath: string;
  }
): { rules: HarnessIgnoreRule[]; diagnostics: HarnessDiagnostic[] } {
  const rules: HarnessIgnoreRule[] = [];
  const diagnostics: HarnessDiagnostic[] = [];
  const lines = raw.split(/\r?\n/);
  let state: SectionState = {
    kind: options.defaultKind,
    scope: "all",
    target: undefined,
    active: true,
  };

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const section = parseScopeSection(line, options.defaultKind);
    if (section) {
      state = section;
      continue;
    }
    if (isSectionHeader(line)) {
      const isMutableInIgnore =
        options.defaultKind === "ignore" &&
        /^\[mutable(?:\s+[^\]]+)?\]$/i.test(line);
      const isIgnoreInMutable =
        options.defaultKind === "mutable" &&
        /^\[ignore(?:\s+[^\]]+)?\]$/i.test(line);
      diagnostics.push({
        severity: "error",
        code: isMutableInIgnore
          ? "harness.ignore_mutable_section_unsupported"
          : isIgnoreInMutable
            ? "harness.mutable_ignore_section_unsupported"
            : "harness.ignore_unsupported_scope",
        message: isMutableInIgnore
          ? `Unsupported .harnessIgnore section "${line}" at line ${
              index + 1
            }. Mutable files are declared in .harnessMutable, not .harnessIgnore.`
          : isIgnoreInMutable
            ? `Unsupported .harnessMutable section "${line}" at line ${
                index + 1
              }. Ignore rules are declared in .harnessIgnore, not .harnessMutable.`
            : `Unsupported ${options.sourcePath.endsWith(HARNESS_MUTABLE_FILE) ? ".harnessMutable" : ".harnessIgnore"} section "${line}" at line ${
                index + 1
              }. Target-specific sections are no longer supported; place a nested .harnessIgnore or .harnessMutable in the source folder instead.`,
        path: options.sourcePath,
        recommendation: isMutableInIgnore
          ? "Move the following patterns into .harnessMutable and keep .harnessIgnore for projection exclusions only."
          : isIgnoreInMutable
            ? "Move the following patterns into .harnessIgnore and keep .harnessMutable for create-once runtime-owned seeds only."
            : "Move the following rules into a nested declaration file in the folder they apply to.",
      });
      state = {
        kind: options.defaultKind,
        scope: "all",
        target: undefined,
        active: false,
      };
      continue;
    }
    if (!state.active) {
      continue;
    }

    const negated = line.startsWith("!");
    const unnegated = negated ? line.slice(1).trim() : line;
    const anchored = unnegated.startsWith("/");
    const withoutAnchor = anchored ? unnegated.slice(1) : unnegated;
    const directoryOnly = withoutAnchor.endsWith("/");
    const pattern = normalizeIgnorePath(
      directoryOnly ? withoutAnchor.slice(0, -1) : withoutAnchor
    );

    if (!pattern) {
      continue;
    }

    rules.push({
      kind: state.kind,
      pattern,
      negated,
      directoryOnly,
      anchored,
      sourceLine: index + 1,
      scope: state.scope,
      target: state.target,
    });
  }

  return { rules, diagnostics };
}

const SYNTHETIC_NESTED_DECLARATION_RULES: HarnessIgnoreRule[] = [
  HARNESS_IGNORE_FILE,
  HARNESS_MUTABLE_FILE,
  HARNESS_PROFILE_FILE,
  HARNESS_PROFILE_ROOT_FILE,
].map((fileName) => ({
  kind: "ignore",
  pattern: `**/${fileName}`,
  negated: false,
  directoryOnly: false,
  anchored: false,
  sourceLine: 0,
  scope: "all",
  target: undefined,
}));

export function createHarnessIgnoreMatcher(
  rules?: HarnessIgnoreRule[]
): HarnessIgnoreMatcher;
export function createHarnessIgnoreMatcher(
  ruleSets: HarnessIgnoreRuleSet[]
): HarnessIgnoreMatcher;
export function createHarnessIgnoreMatcher(
  rulesOrRuleSets: HarnessIgnoreRule[] | HarnessIgnoreRuleSet[] = []
): HarnessIgnoreMatcher {
  const ruleSets = normalizeRuleSets(rulesOrRuleSets);
  return {
    rules: ruleSets.flatMap((ruleSet) => ruleSet.rules),
    ruleSets,
    ignores(relativePath, options = {}) {
      return evaluate(ruleSets, "ignore", relativePath, options);
    },
    isMutable(relativePath, options = {}) {
      return evaluate(ruleSets, "mutable", relativePath, options);
    },
    explain(relativePath, options = {}) {
      return evaluateWithExplanation(
        ruleSets,
        options.kind ?? "ignore",
        relativePath,
        options
      );
    },
  };
}

function normalizeRuleSets(
  rulesOrRuleSets: HarnessIgnoreRule[] | HarnessIgnoreRuleSet[]
): HarnessIgnoreRuleSet[] {
  const inputRuleSets: HarnessIgnoreRuleSet[] = isHarnessIgnoreRuleSetArray(
    rulesOrRuleSets
  )
    ? rulesOrRuleSets
    : [
        {
          rules: rulesOrRuleSets,
          directory: "",
          sourcePath: HARNESS_IGNORE_FILE,
          isRoot: true,
          matchBase: "source",
        },
      ];
  const normalized: HarnessIgnoreRuleSet[] = inputRuleSets.map((ruleSet) => ({
    ...ruleSet,
    directory: normalizeIgnorePath(ruleSet.directory),
    sourcePath: normalizeIgnorePath(ruleSet.sourcePath),
    matchBase: ruleSet.matchBase ?? "source",
    rules: [...ruleSet.rules],
  }));

  const missingSyntheticRules = SYNTHETIC_NESTED_DECLARATION_RULES.filter(
    (rule) => !hasSyntheticNestedDeclarationRule(normalized, rule)
  );
  if (missingSyntheticRules.length > 0) {
    const rootIndex = normalized.findIndex(
      (ruleSet) => ruleSet.directory === ""
    );
    if (rootIndex >= 0) {
      normalized[rootIndex] = {
        ...normalized[rootIndex],
        rules: [...missingSyntheticRules, ...normalized[rootIndex].rules],
      };
    } else {
      normalized.push({
        rules: missingSyntheticRules,
        directory: "",
        sourcePath: HARNESS_IGNORE_FILE,
        isRoot: true,
        matchBase: "both",
      });
    }
  }

  return normalized
    .map((ruleSet, index) => ({ ruleSet, index }))
    .sort(compareRuleSetOrder)
    .map(({ ruleSet }) => ruleSet);
}

function isHarnessIgnoreRuleSetArray(
  input: HarnessIgnoreRule[] | HarnessIgnoreRuleSet[]
): input is HarnessIgnoreRuleSet[] {
  return input.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "rules" in entry &&
      "directory" in entry
  );
}

function hasSyntheticNestedDeclarationRule(
  ruleSets: HarnessIgnoreRuleSet[],
  syntheticRule: HarnessIgnoreRule
): boolean {
  return ruleSets.some((ruleSet) =>
    ruleSet.rules.some(
      (rule) =>
        rule.kind === syntheticRule.kind &&
        rule.pattern === syntheticRule.pattern &&
        rule.sourceLine === syntheticRule.sourceLine
    )
  );
}

function ruleSetDepth(directory: string): number {
  if (!directory) {
    return 0;
  }
  return directory.split("/").filter(Boolean).length;
}

function ruleSetPhase(ruleSet: HarnessIgnoreRuleSet): number {
  if (ruleSet.directory === "") {
    return 0;
  }
  if (
    ruleSet.matchBase === "target" &&
    !ruleSetSourceLivesInDirectory(ruleSet)
  ) {
    return 1.5;
  }
  return ruleSet.matchBase === "target" ? 2 : 1;
}

function ruleSetSourceLivesInDirectory(ruleSet: HarnessIgnoreRuleSet): boolean {
  const sourcePath = normalizeIgnorePath(ruleSet.sourcePath);
  const directory = normalizeIgnorePath(ruleSet.directory);
  return (
    sourcePath === directory ||
    (Boolean(directory) && sourcePath.startsWith(`${directory}/`))
  );
}

function compareRuleSetOrder(
  left: { ruleSet: HarnessIgnoreRuleSet; index: number },
  right: { ruleSet: HarnessIgnoreRuleSet; index: number }
): number {
  const phaseDifference =
    ruleSetPhase(left.ruleSet) - ruleSetPhase(right.ruleSet);
  if (phaseDifference !== 0) {
    return phaseDifference;
  }
  const depthDifference =
    ruleSetDepth(left.ruleSet.directory) -
    ruleSetDepth(right.ruleSet.directory);
  if (depthDifference !== 0) {
    return depthDifference;
  }
  return left.index - right.index;
}

function evaluate(
  ruleSets: HarnessIgnoreRuleSet[],
  kind: HarnessIgnoreRuleKind,
  relativePath: string,
  options: {
    isDirectory?: boolean;
    outputPath?: string;
    profile?: string;
    target?: string;
    targetPath?: string;
  }
): boolean {
  const normalized = normalizeIgnorePath(relativePath);
  if (!normalized) {
    return false;
  }
  const outputNormalized = options.outputPath
    ? normalizeIgnorePath(options.outputPath)
    : undefined;

  let state = false;
  for (const ruleSet of ruleSets) {
    if (ruleSet.profile !== undefined && ruleSet.profile !== options.profile) {
      continue;
    }
    const relativeCandidates = evaluationCandidates(
      ruleSet,
      normalized,
      outputNormalized
    )
      .filter((candidate) => ruleSetParticipates(ruleSet.directory, candidate))
      .map((candidate) =>
        pathRelativeToRuleSetDirectory(ruleSet.directory, candidate)
      );
    if (relativeCandidates.length === 0) {
      continue;
    }

    for (const rule of ruleSet.rules) {
      if (rule.kind !== kind) {
        continue;
      }
      if (!ruleScopeParticipates(rule, options)) {
        continue;
      }
      if (
        relativeCandidates.some((candidate) =>
          matchesRule(rule, candidate, options.isDirectory === true)
        )
      ) {
        state = !rule.negated;
      }
    }
  }
  return applySyntheticDeclarationDecision(kind, normalized, state);
}

function evaluateWithExplanation(
  ruleSets: HarnessIgnoreRuleSet[],
  kind: HarnessIgnoreRuleKind,
  relativePath: string,
  options: {
    isDirectory?: boolean;
    outputPath?: string;
    profile?: string;
    target?: string;
    targetPath?: string;
  }
): HarnessIgnoreExplanation {
  const normalized = normalizeIgnorePath(relativePath);
  const matches: HarnessIgnoreRuleMatch[] = [];
  if (!normalized) {
    return { ignored: false, kind, matches, path: normalized };
  }
  const outputNormalized = options.outputPath
    ? normalizeIgnorePath(options.outputPath)
    : undefined;

  let state = false;
  for (const ruleSet of ruleSets) {
    if (ruleSet.profile !== undefined && ruleSet.profile !== options.profile) {
      continue;
    }
    const candidates = evaluationCandidates(
      ruleSet,
      normalized,
      outputNormalized
    )
      .filter((candidate) => ruleSetParticipates(ruleSet.directory, candidate))
      .map((candidate) => ({
        absolute: candidate,
        relative: pathRelativeToRuleSetDirectory(ruleSet.directory, candidate),
      }));
    if (candidates.length === 0) {
      continue;
    }

    for (const rule of ruleSet.rules) {
      if (rule.kind !== kind || !ruleScopeParticipates(rule, options)) {
        continue;
      }
      const matchedCandidate = candidates.find((candidate) =>
        matchesRule(rule, candidate.relative, options.isDirectory === true)
      );
      if (!matchedCandidate) {
        continue;
      }
      state = !rule.negated;
      matches.push({
        candidatePath: matchedCandidate.absolute,
        directory: ruleSet.directory,
        ignored: state,
        matchBase: ruleSet.matchBase ?? "source",
        profile: ruleSet.profile,
        rule,
        sourcePath: ruleSet.sourcePath,
      });
    }
  }

  if (isSyntheticDeclarationPath(normalized) && kind === "ignore") {
    state = true;
    matches.push({
      candidatePath: normalized,
      directory: "",
      ignored: true,
      matchBase: "both",
      rule: syntheticDeclarationRuleForPath(normalized),
      sourcePath: "<synthetic>",
    });
  }

  return {
    ignored: state,
    kind,
    matches,
    path: normalized,
    finalMatch: matches.at(-1),
  };
}

function applySyntheticDeclarationDecision(
  kind: HarnessIgnoreRuleKind,
  normalizedPath: string,
  state: boolean
): boolean {
  if (kind === "ignore" && isSyntheticDeclarationPath(normalizedPath)) {
    return true;
  }
  return state;
}

function isSyntheticDeclarationPath(normalizedPath: string): boolean {
  return [
    HARNESS_IGNORE_FILE,
    HARNESS_MUTABLE_FILE,
    HARNESS_PROFILE_FILE,
    HARNESS_PROFILE_ROOT_FILE,
  ].some(
    (fileName) =>
      normalizedPath === fileName || normalizedPath.endsWith(`/${fileName}`)
  );
}

function syntheticDeclarationRuleForPath(
  normalizedPath: string
): HarnessIgnoreRule {
  const fileName =
    [
      HARNESS_IGNORE_FILE,
      HARNESS_MUTABLE_FILE,
      HARNESS_PROFILE_FILE,
      HARNESS_PROFILE_ROOT_FILE,
    ].find(
      (candidate) =>
        normalizedPath === candidate || normalizedPath.endsWith(`/${candidate}`)
    ) ?? HARNESS_IGNORE_FILE;
  return {
    kind: "ignore",
    pattern: `**/${fileName}`,
    negated: false,
    directoryOnly: false,
    anchored: false,
    sourceLine: 0,
    scope: "all",
    target: undefined,
  };
}

function ruleScopeParticipates(
  rule: HarnessIgnoreRule,
  options: {
    outputPath?: string;
    target?: string;
    targetPath?: string;
  }
): boolean {
  if (rule.scope === "all") {
    return true;
  }
  const ruleTarget = normalizeHarnessTarget(rule.target);
  const candidateTarget = normalizeHarnessTarget(
    options.target ?? options.targetPath ?? options.outputPath
  );
  if (!ruleTarget || !candidateTarget) {
    return false;
  }
  if (rule.scope === "only") {
    return candidateTarget === ruleTarget;
  }
  return candidateTarget !== ruleTarget;
}

function evaluationCandidates(
  ruleSet: HarnessIgnoreRuleSet,
  sourcePath: string,
  outputPath: string | undefined
): string[] {
  const matchBase = ruleSet.matchBase ?? "source";
  if (matchBase === "source") {
    return [sourcePath];
  }
  if (matchBase === "target") {
    return outputPath ? [outputPath] : [];
  }
  return outputPath && outputPath !== sourcePath
    ? [sourcePath, outputPath]
    : [sourcePath];
}

function ruleSetParticipates(
  directory: string,
  normalizedPath: string
): boolean {
  return (
    directory === "" ||
    normalizedPath === directory ||
    normalizedPath.startsWith(`${directory}/`)
  );
}

function pathRelativeToRuleSetDirectory(
  directory: string,
  normalizedPath: string
): string {
  if (!directory) {
    return normalizedPath;
  }
  if (normalizedPath === directory) {
    return "";
  }
  return normalizedPath.slice(directory.length + 1);
}

function isSectionHeader(line: string): boolean {
  return /^\[[^\]]+\]$/.test(line);
}

function parseScopeSection(
  line: string,
  defaultKind: HarnessIgnoreRuleKind
): SectionState | undefined {
  const match = line.match(
    /^\[(?<body>[a-z][a-z0-9_-]*|\*|global)(?:\s+(?<scope>\*|global))?\]$/i
  );
  const body = match?.groups?.body;
  if (!body) {
    return undefined;
  }

  const normalizedBody = body.toLowerCase();
  const scope = match.groups?.scope?.toLowerCase();
  if (scope && normalizedBody !== "mutable" && normalizedBody !== "ignore") {
    return undefined;
  }
  if (scope && scope !== "*" && scope !== "global") {
    return undefined;
  }
  if (normalizedBody === "mutable" && defaultKind === "mutable") {
    return { kind: "mutable", scope: "all", target: undefined, active: true };
  }
  if (normalizedBody === "ignore" && defaultKind === "ignore") {
    return { kind: "ignore", scope: "all", target: undefined, active: true };
  }
  if (normalizedBody === "*" || normalizedBody === "global") {
    return {
      kind: defaultKind,
      scope: "all",
      target: undefined,
      active: true,
    };
  }
  return undefined;
}

export function normalizeHarnessTarget(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  const firstSegment = normalizeIgnorePath(input).split("/").find(Boolean);
  if (!firstSegment || firstSegment === "*" || firstSegment === "global") {
    return undefined;
  }
  return firstSegment.startsWith(".") ? firstSegment : `.${firstSegment}`;
}

export async function loadHarnessIgnoreMatcher(
  root = process.cwd()
): Promise<HarnessIgnoreMatcher> {
  return (await loadHarnessIgnoreMatcherDetailed(root)).matcher;
}

export async function loadHarnessIgnoreMatcherDetailed(
  root = process.cwd(),
  options: HarnessIgnoreDiscoveryOptions = {}
): Promise<{
  matcher: HarnessIgnoreMatcher;
  diagnostics: HarnessDiagnostic[];
  protectedTargetPaths: string[];
}> {
  const { ruleSets, diagnostics, protectedTargetPaths } =
    await loadHarnessIgnoreRuleSets(root, options);
  return {
    matcher: createHarnessIgnoreMatcher(ruleSets),
    diagnostics,
    protectedTargetPaths,
  };
}

export async function loadHarnessIgnoreRuleSets(
  root = process.cwd(),
  options: HarnessIgnoreDiscoveryOptions = {}
): Promise<{
  ruleSets: HarnessIgnoreRuleSet[];
  diagnostics: HarnessDiagnostic[];
  protectedTargetPaths: string[];
}> {
  const paths = resolveHarnessPaths(root, { config: options.config });
  const ruleFiles = await findHarnessRuleFileEntries(paths.root, options);
  const rootIgnorePath = path.resolve(paths.ignorePath);
  const rootMutablePath = path.resolve(paths.mutablePath);
  const diagnostics: HarnessDiagnostic[] = [];
  const ruleSets: Array<{ ruleSet: HarnessIgnoreRuleSet; index: number }> = [];
  const protectedTargetPaths: string[] = [
    ...(options.protectedTargetPaths ?? []),
  ];

  for (const [index, ruleEntry] of ruleFiles.entries()) {
    const rulePath = ruleEntry.path;
    const raw = await readFile(rulePath, "utf8").catch((error: unknown) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      throw error;
    });
    if (raw === undefined) {
      continue;
    }

    const sourcePath = normalizeIgnorePath(
      toRepoRelative(paths.root, rulePath)
    );
    const resolvedRulePath = path.resolve(rulePath);
    const isRoot =
      resolvedRulePath === rootIgnorePath ||
      resolvedRulePath === rootMutablePath;
    const directory = isRoot
      ? ""
      : normalizeIgnorePath(path.posix.dirname(sourcePath));
    const parsed =
      ruleEntry.kind === "mutable"
        ? parseHarnessMutableFile(raw, { isRoot, sourcePath })
        : parseHarnessIgnoreFile(raw, { isRoot, sourcePath });
    diagnostics.push(...parsed.diagnostics);

    ruleSets.push({
      index,
      ruleSet: {
        rules: parsed.rules,
        directory,
        sourcePath,
        isRoot,
        matchBase:
          isRoot && ruleEntry.kind === "ignore" ? "both" : ruleEntry.matchBase,
      },
    });

    const targetOverrideDirectory =
      !isRoot && ruleEntry.matchBase === "source"
        ? paths.resourcesDirs
            .map((resourcesDir) =>
              targetDirectoryForResourceOverrideDirectory(
                path.posix.dirname(sourcePath),
                toRepoRelative(paths.root, resourcesDir)
              )
            )
            .find(Boolean)
        : undefined;
    if (targetOverrideDirectory) {
      ruleSets.push({
        index,
        ruleSet: {
          rules: parsed.rules,
          directory: targetOverrideDirectory,
          sourcePath,
          isRoot: false,
          matchBase: "target",
        },
      });
    }

    if (ruleEntry.kind === "ignore" && ruleEntry.matchBase === "target") {
      protectedTargetPaths.push(sourcePath);
    }
  }

  for (const [extraIndex, extraRuleSet] of (
    options.extraRuleSets ?? []
  ).entries()) {
    ruleSets.push({
      index: ruleFiles.length + extraIndex,
      ruleSet: extraRuleSet,
    });
    const targetOverrideDirectory = paths.resourcesDirs
      .map((resourcesDir) =>
        targetDirectoryForResourceOverrideDirectory(
          extraRuleSet.directory,
          toRepoRelative(paths.root, resourcesDir)
        )
      )
      .find(Boolean);
    if (extraRuleSet.matchBase !== "target" && targetOverrideDirectory) {
      ruleSets.push({
        index: ruleFiles.length + extraIndex,
        ruleSet: {
          ...extraRuleSet,
          directory: targetOverrideDirectory,
          matchBase: "target",
        },
      });
    }
  }

  const sortedRuleSets = ruleSets
    .sort(compareRuleSetOrder)
    .map(({ ruleSet }) => ruleSet);

  return {
    ruleSets: sortedRuleSets,
    diagnostics,
    protectedTargetPaths: protectedTargetPaths.toSorted((left, right) =>
      left.localeCompare(right)
    ),
  };
}

async function findHarnessRuleFileEntries(
  root: string,
  options: HarnessIgnoreDiscoveryOptions
): Promise<HarnessRuleFileEntry[]> {
  const paths = resolveHarnessPaths(root, { config: options.config });
  const entries = new Map<string, HarnessRuleFileEntry>();
  await addRuleFileIfPresent(entries, paths.ignorePath, "both", "ignore");
  await addRuleFileIfPresent(entries, paths.mutablePath, "source", "mutable");

  const sourceRoots =
    options.sourceRoots ??
    (options.config
      ? sourceRootsForConfig(root, options.config)
      : [paths.harnessDir]);
  for (const sourceRoot of sourceRoots) {
    await addNestedRuleFiles(entries, sourceRoot, "source", [
      "ignore",
      "mutable",
    ]);
  }

  const targetRoots = [
    ...(options.targetRoots ?? []),
    ...(options.config
      ? options.config.targets.map((target) =>
          resolveRepoLocalPath(root, target.path, `Target "${target.path}"`)
        )
      : []),
  ];
  for (const targetRoot of targetRoots) {
    await addNestedRuleFiles(entries, targetRoot, "target", ["ignore"]);
  }

  for (const outputPath of options.targetOutputPaths ?? []) {
    await addOutputAncestorIgnoreFiles(entries, root, outputPath);
  }

  return [...entries.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
}

function sourceRootsForConfig(root: string, config: HarnessConfig): string[] {
  const paths = resolveHarnessPaths(root, { config });
  const roots = new Set<string>([
    paths.harnessDir,
    ...paths.resourcesDirs,
    ...paths.dirDirs,
  ]);
  return [...roots];
}

function targetDirectoryForResourceOverrideDirectory(
  sourceDirectory: string,
  resourcesDirectory = ".harness/resources"
): string | undefined {
  const prefix = `${normalizeIgnorePath(resourcesDirectory)}/`;
  const normalized = normalizeIgnorePath(sourceDirectory);
  if (!normalized.startsWith(prefix)) {
    return undefined;
  }

  const directory = normalized.slice(prefix.length);
  if (!directory || directory === ".") {
    return undefined;
  }

  const segments = directory.split("/").filter(Boolean);
  const overrideIndex = segments.findIndex((segment) =>
    segment.startsWith(".")
  );
  if (overrideIndex < 0) {
    return undefined;
  }

  return [
    segments[overrideIndex],
    ...segments.slice(0, overrideIndex),
    ...segments.slice(overrideIndex + 1),
  ].join("/");
}

async function addNestedRuleFiles(
  entries: Map<string, HarnessRuleFileEntry>,
  rootPath: string,
  matchBase: HarnessIgnoreMatchBase,
  kinds: HarnessRuleFileKind[]
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
        if (
          matchBase === "source" &&
          (await hasHarnessProfileRootMarker(absolutePath))
        ) {
          continue;
        }
        await visit(absolutePath);
        continue;
      }
      if (
        child.isFile() &&
        ((child.name === HARNESS_IGNORE_FILE && kinds.includes("ignore")) ||
          (child.name === HARNESS_MUTABLE_FILE && kinds.includes("mutable")))
      ) {
        entries.set(path.resolve(absolutePath), {
          kind: child.name === HARNESS_MUTABLE_FILE ? "mutable" : "ignore",
          path: path.resolve(absolutePath),
          matchBase,
        });
      }
    }
  }

  await visit(rootPath);
}

async function hasHarnessProfileRootMarker(
  directory: string
): Promise<boolean> {
  const state = await lstat(
    path.join(directory, HARNESS_PROFILE_ROOT_FILE)
  ).catch(() => undefined);
  return Boolean(state?.isFile());
}

async function addOutputAncestorIgnoreFiles(
  entries: Map<string, HarnessRuleFileEntry>,
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
    await addIgnoreFileIfPresent(
      entries,
      path.join(root, directory, HARNESS_IGNORE_FILE),
      "target"
    );
  }
}

async function addIgnoreFileIfPresent(
  entries: Map<string, HarnessRuleFileEntry>,
  ignorePath: string,
  matchBase: HarnessIgnoreMatchBase
): Promise<void> {
  await addRuleFileIfPresent(entries, ignorePath, matchBase, "ignore");
}

async function addRuleFileIfPresent(
  entries: Map<string, HarnessRuleFileEntry>,
  rulePath: string,
  matchBase: HarnessIgnoreMatchBase,
  kind: HarnessRuleFileKind
): Promise<void> {
  const state = await lstat(rulePath).catch(() => undefined);
  if (state?.isFile()) {
    entries.set(path.resolve(rulePath), {
      kind,
      path: path.resolve(rulePath),
      matchBase,
    });
  }
}

export function normalizeIgnorePath(input: string): string {
  return input
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function matchesRule(
  rule: HarnessIgnoreRule,
  normalizedPath: string,
  isDirectory: boolean
): boolean {
  const pattern = normalizeIgnorePath(rule.pattern);
  if (!pattern) {
    return false;
  }

  if (rule.anchored) {
    return directoryAwarePathMatches(
      rule,
      normalizedPath,
      pattern,
      isDirectory
    );
  }

  if (!pattern.includes("/")) {
    return normalizedPath.split("/").some((segment, index, segments) => {
      if (!globSegmentMatches(segment, pattern)) {
        return false;
      }
      return directoryRuleCanMatch(rule, index, segments, isDirectory);
    });
  }

  return (
    directoryAwarePathMatches(rule, normalizedPath, pattern, isDirectory) ||
    normalizedPath
      .split("/")
      .some((_, index, segments) =>
        directoryAwarePathMatches(
          rule,
          segments.slice(index).join("/"),
          pattern,
          isDirectory
        )
      )
  );
}

function directoryRuleCanMatch(
  rule: HarnessIgnoreRule,
  matchedSegmentIndex: number,
  segments: string[],
  isDirectory: boolean
): boolean {
  if (!rule.directoryOnly) {
    return true;
  }
  if (rule.negated) {
    return isDirectory && matchedSegmentIndex === segments.length - 1;
  }
  return isDirectory || matchedSegmentIndex < segments.length - 1;
}

function directoryAwarePathMatches(
  rule: HarnessIgnoreRule,
  normalizedPath: string,
  pattern: string,
  isDirectory: boolean
): boolean {
  if (!pathMatchesPattern(normalizedPath, pattern)) {
    return false;
  }
  if (!rule.directoryOnly) {
    return true;
  }

  if (globExactPathMatches(normalizedPath, pattern)) {
    return isDirectory;
  }
  if (rule.negated) {
    return false;
  }
  return true;
}

function pathMatchesPattern(normalizedPath: string, pattern: string): boolean {
  if (globPathMatches(normalizedPath, pattern)) {
    return true;
  }
  return normalizedPath
    .split("/")
    .some((_, index, segments) =>
      globPathMatches(segments.slice(0, index + 1).join("/"), pattern)
    );
}

function globPathMatches(normalizedPath: string, pattern: string): boolean {
  const regex = new RegExp(`^${globToRegex(pattern)}(?:/.*)?$`);
  return regex.test(normalizedPath);
}

function globExactPathMatches(
  normalizedPath: string,
  pattern: string
): boolean {
  const regex = new RegExp(`^${globToRegex(pattern)}$`);
  return regex.test(normalizedPath);
}

function globSegmentMatches(segment: string, pattern: string): boolean {
  return new RegExp(`^${globToRegex(pattern)}$`).test(segment);
}

function globToRegex(pattern: string): string {
  let output = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const next = pattern[index + 1];
    if (character === "*" && next === "*") {
      output += ".*";
      index += 1;
      continue;
    }
    if (character === "*") {
      output += "[^/]*";
      continue;
    }
    if (character === "?") {
      output += "[^/]";
      continue;
    }
    output += escapeRegex(character ?? "");
  }
  return output;
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

export function createDefaultHarnessIgnore(): string {
  return [
    "# Files matched here are ignored when projecting .harness resources into live harness surfaces.",
    "# Patterns are repo-relative and use gitignore-style * and ** wildcards.",
    "# Nested .harnessIgnore files inside .harness/ apply to their directory and descendants.",
    "# Place target-specific rules in a nested target-output .harnessIgnore file,",
    "# such as .claude/skills/<name>/.harnessIgnore.",
    "# Example: .harness/**/logs/",
    "",
  ].join("\n");
}

export function createDefaultHarnessMutable(): string {
  return [
    "# Files matched here are mutable: Harness seeds them when missing, then the runtime owns them.",
    "# Mutable is different from ignore. Source files still project when the target file is absent.",
    "# Patterns are repo-relative and use gitignore-style * and ** wildcards.",
    "# Nested .harnessMutable files inside .harness/ apply to their directory and descendants.",
    "# Example: .harness/**/settings.local.json",
    "",
  ].join("\n");
}

export { HARNESS_IGNORE_FILE, HARNESS_MUTABLE_FILE };
