import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  HARNESS_IGNORE_FILE,
  HARNESS_PROFILE_FILE,
  HARNESS_PROFILE_ROOT_FILE,
  resolveHarnessPaths,
  resolveRepoLocalPath,
  toRepoRelative,
} from "./paths";
import { DEFAULT_HARNESS_DIR_PATH, type HarnessConfig } from "./standard";
import type {
  HarnessDiagnostic,
  HarnessIgnoreMatcher,
  HarnessIgnoreMatchBase,
  HarnessIgnoreRule,
  HarnessIgnoreRuleKind,
  HarnessIgnoreRuleSet,
} from "./types";

type SectionState = Pick<HarnessIgnoreRule, "kind" | "scope" | "target"> & {
  active: boolean;
};

type HarnessIgnoreFileEntry = {
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
    isRoot: true,
    sourcePath: HARNESS_IGNORE_FILE,
  }).rules;
}

export function parseHarnessIgnoreFile(
  raw: string,
  options: {
    isRoot: boolean;
    sourcePath: string;
  }
): { rules: HarnessIgnoreRule[]; diagnostics: HarnessDiagnostic[] } {
  return parseHarnessIgnoreLines(raw, options);
}

function parseHarnessIgnoreLines(
  raw: string,
  options: {
    isRoot: boolean;
    sourcePath: string;
  }
): { rules: HarnessIgnoreRule[]; diagnostics: HarnessDiagnostic[] } {
  const rules: HarnessIgnoreRule[] = [];
  const diagnostics: HarnessDiagnostic[] = [];
  const lines = raw.split(/\r?\n/);
  let state: SectionState = {
    kind: "ignore",
    scope: "all",
    target: undefined,
    active: true,
  };

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const section = parseScopeSection(line);
    if (section) {
      state = section;
      continue;
    }
    if (isSectionHeader(line)) {
      diagnostics.push({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        message: `Unsupported .harnessIgnore section "${line}" at line ${
          index + 1
        }. Target-specific sections are no longer supported; place a nested .harnessIgnore in the source or target-output folder instead.`,
        path: options.sourcePath,
        recommendation:
          "Move the following rules into a nested .harnessIgnore file in the folder they apply to.",
      });
      state = {
        kind: "ignore",
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
  return ruleSet.matchBase === "target" ? 2 : 1;
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
    globalOnly?: boolean;
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
      if (rule.scope !== "all") {
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
  return state;
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

function parseScopeSection(line: string): SectionState | undefined {
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
  if (normalizedBody === "mutable") {
    return { kind: "mutable", scope: "all", target: undefined, active: true };
  }
  if (
    normalizedBody === "ignore" ||
    normalizedBody === "*" ||
    normalizedBody === "global"
  ) {
    return { kind: "ignore", scope: "all", target: undefined, active: true };
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
  const paths = resolveHarnessPaths(root);
  const ignoreFiles = await findHarnessIgnoreFileEntries(paths.root, options);
  const rootIgnorePath = path.resolve(paths.ignorePath);
  const diagnostics: HarnessDiagnostic[] = [];
  const ruleSets: Array<{ ruleSet: HarnessIgnoreRuleSet; index: number }> = [];
  const protectedTargetPaths: string[] = [
    ...(options.protectedTargetPaths ?? []),
  ];

  for (const [index, ignoreEntry] of ignoreFiles.entries()) {
    const ignorePath = ignoreEntry.path;
    const raw = await readFile(ignorePath, "utf8").catch((error: unknown) => {
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
      toRepoRelative(paths.root, ignorePath)
    );
    const isRoot = path.resolve(ignorePath) === rootIgnorePath;
    const directory = isRoot
      ? ""
      : normalizeIgnorePath(path.posix.dirname(sourcePath));
    const parsed = parseHarnessIgnoreFile(raw, { isRoot, sourcePath });
    diagnostics.push(...parsed.diagnostics);

    ruleSets.push({
      index,
      ruleSet: {
        rules: parsed.rules,
        directory,
        sourcePath,
        isRoot,
        matchBase: isRoot ? "both" : ignoreEntry.matchBase,
      },
    });

    if (ignoreEntry.matchBase === "target") {
      protectedTargetPaths.push(sourcePath);
    }
  }

  for (const [extraIndex, extraRuleSet] of (
    options.extraRuleSets ?? []
  ).entries()) {
    ruleSets.push({
      index: ignoreFiles.length + extraIndex,
      ruleSet: extraRuleSet,
    });
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

async function findHarnessIgnoreFileEntries(
  root: string,
  options: HarnessIgnoreDiscoveryOptions
): Promise<HarnessIgnoreFileEntry[]> {
  const paths = resolveHarnessPaths(root);
  const entries = new Map<string, HarnessIgnoreMatchBase>();
  await addIgnoreFileIfPresent(entries, paths.ignorePath, "both");

  const sourceRoots =
    options.sourceRoots ??
    (options.config
      ? sourceRootsForConfig(root, options.config)
      : [paths.harnessDir]);
  for (const sourceRoot of sourceRoots) {
    await addNestedIgnoreFiles(entries, sourceRoot, "source");
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
    await addNestedIgnoreFiles(entries, targetRoot, "target");
  }

  for (const outputPath of options.targetOutputPaths ?? []) {
    await addOutputAncestorIgnoreFiles(entries, root, outputPath);
  }

  return [...entries.entries()]
    .map(([ignorePath, matchBase]) => ({ path: ignorePath, matchBase }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function sourceRootsForConfig(root: string, config: HarnessConfig): string[] {
  const roots = new Set<string>([resolveHarnessPaths(root).harnessDir]);
  for (const definition of Object.values(config.resources)) {
    roots.add(
      resolveRepoLocalPath(root, definition.path, "Resource source path")
    );
  }
  if (config.dir) {
    roots.add(resolveRepoLocalPath(root, config.dir.path, "Dir source path"));
  } else {
    roots.add(
      resolveRepoLocalPath(root, DEFAULT_HARNESS_DIR_PATH, "Dir source path")
    );
  }
  return [...roots];
}

async function addNestedIgnoreFiles(
  entries: Map<string, HarnessIgnoreMatchBase>,
  rootPath: string,
  matchBase: HarnessIgnoreMatchBase
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
      if (child.name === HARNESS_IGNORE_FILE && child.isFile()) {
        entries.set(path.resolve(absolutePath), matchBase);
      }
    }
  }

  await visit(rootPath);
}

async function addOutputAncestorIgnoreFiles(
  entries: Map<string, HarnessIgnoreMatchBase>,
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
  entries: Map<string, HarnessIgnoreMatchBase>,
  ignorePath: string,
  matchBase: HarnessIgnoreMatchBase
): Promise<void> {
  const state = await lstat(ignorePath).catch(() => undefined);
  if (state?.isFile()) {
    entries.set(path.resolve(ignorePath), matchBase);
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
    "# Use [mutable] to mark files the runtime owns after first projection (e.g. .harness/**/settings.local.json).",
    "# Nested .harnessIgnore files inside .harness/ apply to their directory and descendants.",
    "# Place target-specific rules in a nested target-output .harnessIgnore file,",
    "# such as .claude/skills/<name>/.harnessIgnore.",
    "# Example: .harness/**/logs/",
    "",
  ].join("\n");
}

export { HARNESS_IGNORE_FILE };
