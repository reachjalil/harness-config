import { access, lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  env as processEnv,
  stdin as processStdin,
  stdout as processStdout,
} from "node:process";
import { createInterface } from "node:readline/promises";

import {
  applyHarnessActivation,
  applyHarnessInitialization,
  CONVENTIONAL_HARNESS_RESOURCES,
  createDefaultHarnessConfig,
  formatActivationPlan,
  formatActivationResult,
  formatDiagnostics,
  formatInitializationPlan,
  formatInitializationResult,
  harnessConfigSchema,
  loadHarnessIgnoreMatcherDetailed,
  loadHarnessProfileContext,
  logicalPathForProfilePath,
  parseHarnessConfigToml,
  planHarnessActivation,
  planHarnessInitialization,
  resolveHarnessPaths,
  toRepoRelative,
  validateHarnessConfig,
} from "@harnessconfig/core";
import type {
  HarnessActivationPlan,
  HarnessConfig,
  HarnessFormatOptions,
  HarnessIgnoreExplanation,
  HarnessInspection,
} from "@harnessconfig/core";
import {
  applyRegisteredExtensions,
  formatExtensionActivationPlan,
  formatExtensionActivationResult,
  hasExtensionActivationErrors,
  hasExtensionActivationOutput,
  planRegisteredExtensions,
} from "./extensions";

type CliOptions = {
  command: string;
  commandExplicit: boolean;
  root: string;
  rootExplicit: boolean;
  configPath?: string;
  json: boolean;
  yes: boolean;
  dryRun: boolean;
  help: boolean;
  cleanupUnmanaged?: "keep" | "remove";
  mutablePolicy?: "skip" | "force";
  targetSymlinkPolicy?: "conflict" | "replace";
  allExtensions: boolean;
  extensions: string[];
  explainPath?: string;
  resources: string[];
  resourcesPath?: string;
  targets: string[];
};

type CliIo = {
  supportsColor?: boolean;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

const DEFAULT_IO: CliIo = {
  supportsColor: processStdout.isTTY,
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
};

const HELP = `harnessc

Usage:
  harnessc validate [--root <path>] [--config <path>] [--json]
  harnessc explain <path> [--root <path>] [--config <path>] [--json]
  harnessc init [--root <path>] [--config <path>] [--resources-path <path>]
                [--dry-run] [--yes] [--resource <kind>] [--target <path>]
  harnessc activate [--root <path>] [--dry-run] [--yes]
                    [--config <path>]
                    [--keep-unmanaged|--remove-unmanaged]
                    [--force-mutable] [--replace-target-symlinks] [--json]
  harnessc extension activate [--root <path>] [--config <path>]
                              [--dry-run] [--yes]
                              [--extension <id>|--all] [--json]
  harnessc plan [--root <path>] [--config <path>] [--resources-path <path>]
                [--resource <kind>] [--target <path>] [--json]

Commands:
  validate    Validate the repository against the Harness config standard.
  explain     Explain how a source or output path participates in projection.
  init        Plan or create .harness resource structure.
  activate    Plan or apply idempotent Harness config projections.
  extension   Plan or apply registered Harness config extensions.
  plan        Show a read-only initialization/adoption plan, not a projection preview.

Harness config standardizes a versioned TOML manifest, configured resources
source tree, target declarations, and .harnessIgnore projection boundaries.
The default manifest is ./.harness/harness.toml, but --config can point at any
repo-local TOML file. When --root and --config are omitted, harnessc searches
upward for the nearest .harness/harness.toml. Init uses skills, rules, and
plugins as conventional resource folders under the configured resources path
unless --resource is supplied. Targets are explicit repo-local paths declared
with --target.
Declared [[dir]] source roots compose folders that contain a
.harnessComposable marker file from their numbered parts into a single output
file, and copy any other files to their matching repo-relative paths.

Activation without --yes is the projection preview. Activation keeps unmanaged
target entries by default. Use --remove-unmanaged to delete target entries that
are not present in the computed Harness config projection. Managed target edits are
overwritten from configured sources on update. Mutable target files declared under
[mutable] in .harnessIgnore are created once and then left alone; use
--force-mutable to re-project them from source. Target symlinks that occupy
projected paths are conflicts by default; use --replace-target-symlinks or
[activation].targetSymlinks = "replace" to replace the link itself. Extensions are activated
separately with harnessc extension activate. Init, activate, and extension
activate are dry runs unless --yes is supplied.
`;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "",
    commandExplicit: false,
    root: process.cwd(),
    rootExplicit: false,
    json: false,
    yes: false,
    dryRun: false,
    help: false,
    allExtensions: false,
    extensions: [],
    resources: [],
    targets: [],
  };
  let sawKeepUnmanaged = false;
  let sawRemoveUnmanaged = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--keep-unmanaged") {
      sawKeepUnmanaged = true;
      options.cleanupUnmanaged = "keep";
      continue;
    }
    if (arg === "--remove-unmanaged") {
      sawRemoveUnmanaged = true;
      options.cleanupUnmanaged = "remove";
      continue;
    }
    if (arg === "--force-mutable") {
      options.mutablePolicy = "force";
      continue;
    }
    if (arg === "--replace-target-symlinks") {
      options.targetSymlinkPolicy = "replace";
      continue;
    }
    if (arg === "--all") {
      options.allExtensions = true;
      continue;
    }
    if (arg === "--extension") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires an extension id.`);
      }
      options.extensions.push(value);
      index += 1;
      continue;
    }
    if (arg === "--root" || arg === "-C") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a path.`);
      }
      options.root = value;
      options.rootExplicit = true;
      index += 1;
      continue;
    }
    if (arg === "--config") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a path.`);
      }
      options.configPath = value;
      index += 1;
      continue;
    }
    if (arg === "--resources-path") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a path.`);
      }
      options.resourcesPath = value;
      index += 1;
      continue;
    }
    if (arg === "--resource") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a resource id.`);
      }
      options.resources.push(value);
      index += 1;
      continue;
    }
    if (arg === "--target") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a path.`);
      }
      options.targets.push(value);
      index += 1;
      continue;
    }
    if (!options.command) {
      if (arg === "extension") {
        const subcommand = argv[index + 1];
        if (subcommand && !subcommand.startsWith("-")) {
          options.command = `extension ${subcommand}`;
          options.commandExplicit = true;
          index += 1;
          continue;
        }
      }
      options.command = arg;
      options.commandExplicit = true;
      continue;
    }
    if (options.command === "explain" && !options.explainPath) {
      options.explainPath = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.command) {
    options.command = "validate";
  }

  if (sawKeepUnmanaged && sawRemoveUnmanaged) {
    throw new Error(
      "Use either --keep-unmanaged or --remove-unmanaged, not both."
    );
  }

  if (
    options.command !== "extension activate" &&
    (options.allExtensions || options.extensions.length > 0)
  ) {
    throw new Error(
      "--extension and --all are only supported by harnessc extension activate."
    );
  }

  return options;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverHarnessRoot(start: string): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    const defaultManifestPath = path.join(current, ".harness", "harness.toml");
    if (await pathExists(defaultManifestPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(start);
    }
    current = parent;
  }
}

type SourceStats = {
  targetCount: number;
  resourceFiles: number;
  resourceKinds: number;
  composableFiles: number;
  dirPaths: string[];
};

const CLI_ANSI = {
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  reset: "\u001b[0m",
  yellow: "\u001b[33m",
};

function cliStyle(
  options: HarnessFormatOptions | undefined,
  code: string,
  text: string
): string {
  return options?.color ? `${code}${text}${CLI_ANSI.reset}` : text;
}

function cliLabel(options: HarnessFormatOptions | undefined, text: string) {
  return cliStyle(options, CLI_ANSI.dim, text);
}

function cliValue(options: HarnessFormatOptions | undefined, text: string) {
  return cliStyle(options, CLI_ANSI.cyan, text);
}

function plural(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function displayRepoPath(repoPath: string): string {
  return repoPath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    !relative || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function countFilesAndComposables(directory: string): Promise<{
  files: number;
  composables: number;
}> {
  const state = await lstat(directory).catch(() => undefined);
  if (!state?.isDirectory() || state.isSymbolicLink()) {
    return { files: 0, composables: 0 };
  }

  let files = 0;
  let composables = 0;
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => []
  );
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      const child = await countFilesAndComposables(absolutePath);
      files += child.files;
      composables += child.composables;
      continue;
    }
    if (entry.isFile()) {
      if (entry.name === ".harnessComposable") {
        composables += 1;
      } else {
        files += 1;
      }
    }
  }
  return { files, composables };
}

async function countResourceKinds(resourcesDir: string): Promise<number> {
  const entries = await readdir(resourcesDir, { withFileTypes: true }).catch(
    () => []
  );
  return entries.filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith(".")
  ).length;
}

async function collectSourceStats(
  inspection: HarnessInspection
): Promise<SourceStats | undefined> {
  if (!inspection.hasHarnessConfig) {
    return undefined;
  }

  const raw = await readFile(inspection.paths.configPath, "utf8").catch(
    () => undefined
  );
  if (raw === undefined) {
    return undefined;
  }

  let config: HarnessConfig;
  try {
    config = parseHarnessConfigToml(raw);
  } catch {
    return undefined;
  }

  const paths = resolveHarnessPaths(inspection.root, { config });
  const resourcesList = await Promise.all(
    paths.resourcesDirs.map((resourcesDir) =>
      countFilesAndComposables(resourcesDir)
    )
  );
  const dirList = await Promise.all(
    paths.dirDirs.map((dirDir) => countFilesAndComposables(dirDir))
  );
  const resources = resourcesList.reduce(
    (sum, entry) => ({
      files: sum.files + entry.files,
      composables: sum.composables + entry.composables,
    }),
    { files: 0, composables: 0 }
  );
  const dir = dirList.reduce(
    (sum, entry) => ({
      files: sum.files + entry.files,
      composables: sum.composables + entry.composables,
    }),
    { files: 0, composables: 0 }
  );
  const resourceKinds = (
    await Promise.all(paths.resourcesDirs.map(countResourceKinds))
  ).reduce((sum, count) => sum + count, 0);

  return {
    targetCount: config.targets.length,
    resourceFiles: resources.files,
    resourceKinds,
    composableFiles: resources.composables + dir.composables,
    dirPaths: config.dir.map((source) => source.path),
  };
}

async function formatProjectionStatus(
  inspection: HarnessInspection,
  configPath: string | undefined,
  options: HarnessFormatOptions
): Promise<string | undefined> {
  if (!inspection.hasHarnessConfig) {
    return undefined;
  }
  const plan = await planHarnessActivation(inspection.root, {
    configPath,
  }).catch(() => undefined);
  if (!plan) {
    return `${cliLabel(options, "Projection:")} ${cliStyle(
      options,
      CLI_ANSI.red,
      "blocked"
    )} - inspect issues before activation`;
  }
  if (plan.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return `${cliLabel(options, "Projection:")} ${cliStyle(
      options,
      CLI_ANSI.red,
      "blocked"
    )} - fix issues before activation`;
  }

  const targetActions = plan.targets.flatMap((target) => target.actions);
  const create =
    targetActions.filter((action) => action.kind === "create").length +
    plan.dir.actions.filter((action) => action.kind === "create").length;
  const update =
    targetActions.filter((action) => action.kind === "update").length +
    plan.dir.actions.filter((action) => action.kind === "update").length;
  const remove = targetActions.filter(
    (action) => action.kind === "remove"
  ).length;

  if (create + update + remove === 0) {
    return `${cliLabel(options, "Projection:")} ${cliStyle(
      options,
      CLI_ANSI.green,
      "clean"
    )} - no pending writes`;
  }

  return `${cliLabel(options, "Projection:")} ${cliStyle(
    options,
    CLI_ANSI.yellow,
    "dirty"
  )} - ${cliStyle(options, CLI_ANSI.green, `create ${create}`)}, ${cliStyle(
    options,
    CLI_ANSI.yellow,
    `update ${update}`
  )}, ${cliStyle(options, CLI_ANSI.red, `remove ${remove}`)}`;
}

async function explainHarnessPath(
  root: string,
  configPath: string | undefined,
  inputPath: string,
  options: HarnessFormatOptions
): Promise<unknown> {
  const inspection = await validateHarnessConfig(root, { configPath });
  const absoluteRoot = path.resolve(inspection.root);
  const absoluteInput = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(absoluteRoot, inputPath);
  const repoPath = displayRepoPath(toRepoRelative(absoluteRoot, absoluteInput));
  const raw = await readFile(inspection.paths.configPath, "utf8").catch(
    () => undefined
  );
  if (raw === undefined) {
    return {
      path: repoPath,
      diagnostics: inspection.diagnostics,
      explanation: "No selected harness.toml was found.",
    };
  }

  const config = parseHarnessConfigToml(raw);
  const paths = resolveHarnessPaths(absoluteRoot, { config, configPath });
  const sourceRoots = [
    ...paths.resourcesDirs.map((sourceRoot, index) => ({
      kind: "resources",
      index,
      path: sourceRoot,
    })),
    ...paths.dirDirs.map((sourceRoot, index) => ({
      kind: "dir",
      index,
      path: sourceRoot,
    })),
  ];
  const matchingSourceRoot = sourceRoots.find((sourceRoot) =>
    isInsideOrEqual(sourceRoot.path, absoluteInput)
  );
  const matchingTargetRoot = config.targets.find((target) =>
    isInsideOrEqual(path.resolve(absoluteRoot, target.path), absoluteInput)
  );
  const plan = await planHarnessActivation(absoluteRoot, { configPath });
  const targetOutputPaths = [
    ...plan.targets.flatMap((target) =>
      target.actions.map((action) =>
        toRepoRelative(plan.root, action.targetPath)
      )
    ),
    ...plan.dir.actions.map((action) => action.relativePath),
    ...(matchingSourceRoot ? [] : [repoPath]),
  ];
  const profileContext = await loadHarnessProfileContext(absoluteRoot, {
    config,
    targetOutputPaths,
  });
  const { matcher, diagnostics: ignoreDiagnostics } =
    await loadHarnessIgnoreMatcherDetailed(absoluteRoot, {
      config,
      extraRuleSets: profileContext.ignoreRuleSets,
      protectedTargetPaths: profileContext.protectedTargetPaths,
      targetOutputPaths,
    });
  const matchingTargetActions = plan.targets.flatMap((target) =>
    target.actions
      .filter(
        (action) =>
          displayRepoPath(toRepoRelative(plan.root, action.targetPath)) ===
          repoPath
      )
      .map((action) => ({ target: target.path, ...action }))
  );
  const matchingDirActions = plan.dir.actions.filter(
    (action) =>
      displayRepoPath(toRepoRelative(plan.root, action.targetPath)) === repoPath
  );
  const matchingSourceActions = [
    ...plan.targets.flatMap((target) =>
      target.actions
        .filter(
          (action) =>
            action.sourcePath &&
            displayRepoPath(toRepoRelative(plan.root, action.sourcePath)) ===
              repoPath
        )
        .map((action) => ({ target: target.path, ...action }))
    ),
    ...plan.dir.actions.filter((action) =>
      action.sourcePaths.some(
        (sourcePath) =>
          displayRepoPath(toRepoRelative(plan.root, sourcePath)) === repoPath
      )
    ),
  ];
  const profileRoot = profileContext.profileRoots.find((candidate) =>
    isInsideOrEqual(candidate.rootDir, absoluteInput)
  );
  const logicalRepoPath = profileRoot
    ? displayRepoPath(
        toRepoRelative(
          absoluteRoot,
          logicalPathForProfilePath(profileRoot, absoluteInput)
        )
      )
    : repoPath;
  const activeProfile =
    profileRoot?.profile ?? profileContext.profileForOutput(repoPath);
  const sourceIgnore = matchingSourceRoot
    ? matcher.explain(logicalRepoPath, {
        isDirectory: (
          await lstat(absoluteInput).catch(() => undefined)
        )?.isDirectory(),
        profile: activeProfile,
      })
    : undefined;
  const targetIgnore = matchingTargetRoot
    ? matcher.explain(repoPath, {
        isDirectory: (
          await lstat(absoluteInput).catch(() => undefined)
        )?.isDirectory(),
        outputPath: repoPath,
        profile: profileContext.profileForOutput(repoPath),
        targetPath: matchingTargetRoot.path,
      })
    : undefined;
  const ignore = {
    source: sourceIgnore
      ? formatIgnoreExplanation(sourceIgnore, logicalRepoPath)
      : undefined,
    targetOutput: targetIgnore
      ? formatIgnoreExplanation(targetIgnore, repoPath)
      : undefined,
  };
  const ignoreSummary = explainIgnoreSummary(
    ignore.source,
    ignore.targetOutput
  );
  const diagnostics = [...plan.diagnostics, ...ignoreDiagnostics];

  return {
    root: absoluteRoot,
    path: repoPath,
    logicalPath: logicalRepoPath !== repoPath ? logicalRepoPath : undefined,
    sourceRoot: matchingSourceRoot
      ? {
          kind: matchingSourceRoot.kind,
          index: matchingSourceRoot.index,
          path: displayRepoPath(
            toRepoRelative(absoluteRoot, matchingSourceRoot.path)
          ),
        }
      : undefined,
    outputActions: matchingTargetActions,
    dirActions: matchingDirActions,
    sourceActions: matchingSourceActions,
    ignore,
    diagnostics,
    explanation:
      ignoreSummary ??
      (matchingTargetActions.length > 0 || matchingDirActions.length > 0
        ? "This path is a planned output."
        : matchingSourceActions.length > 0
          ? "This source path participates in the current projection."
          : matchingSourceRoot
            ? "This path is under a configured source root but does not appear in the current projection plan. It may be ignored, inactive for the selected target/profile, overridden by a later source, or not a projectable file."
            : "This path is not under a configured source root and is not a planned output."),
    color: options.color === true,
  };
}

type FormattedIgnoreExplanation = {
  ignored: boolean;
  path: string;
  finalMatch?: {
    candidatePath: string;
    directory: string;
    ignored: boolean;
    matchBase: string;
    pattern: string;
    profile?: string;
    sourceLine: number;
    sourcePath: string;
  };
  matches: Array<{
    candidatePath: string;
    directory: string;
    ignored: boolean;
    matchBase: string;
    pattern: string;
    profile?: string;
    sourceLine: number;
    sourcePath: string;
  }>;
};

function formatIgnoreExplanation(
  explanation: HarnessIgnoreExplanation,
  displayPath: string
): FormattedIgnoreExplanation {
  const matches = explanation.matches.map((match) => ({
    candidatePath: match.candidatePath,
    directory: match.directory,
    ignored: match.ignored,
    matchBase: match.matchBase,
    pattern: match.rule.pattern,
    profile: match.profile,
    sourceLine: match.rule.sourceLine,
    sourcePath: match.sourcePath,
  }));
  return {
    ignored: explanation.ignored,
    path: displayPath,
    finalMatch: matches.at(-1),
    matches,
  };
}

function explainIgnoreSummary(
  source: FormattedIgnoreExplanation | undefined,
  targetOutput: FormattedIgnoreExplanation | undefined
): string | undefined {
  if (targetOutput?.ignored) {
    const final = targetOutput.finalMatch;
    if (final?.matchBase === "target") {
      return "This path is excluded by a target-output .harnessIgnore final boundary.";
    }
    return "This path is ignored by .harnessIgnore output-path rules.";
  }
  if (source?.ignored) {
    const final = source.finalMatch;
    if (final?.sourcePath === ".harnessIgnore") {
      return "This path is ignored by the repo-root .harnessIgnore.";
    }
    return "This path is ignored by .harnessIgnore source-path rules.";
  }
  if (source?.finalMatch?.ignored === false) {
    return source.finalMatch.profile
      ? "This path is re-included by a profile-local .harnessIgnore logical rule."
      : "This path is re-included by a deeper source-local .harnessIgnore rule.";
  }
  return undefined;
}

function formatExplainResult(
  result: Awaited<ReturnType<typeof explainHarnessPath>>,
  options: HarnessFormatOptions
): string {
  const value = result as {
    root: string;
    path: string;
    sourceRoot?: { kind: string; index: number; path: string };
    outputActions?: Array<{
      kind: string;
      target?: string;
      targetPath: string;
      sourcePath?: string;
      reason?: string;
    }>;
    dirActions?: Array<{
      kind: string;
      targetPath: string;
      sourcePaths: string[];
      outputKind: string;
      reason?: string;
    }>;
    sourceActions?: Array<{
      kind: string;
      target?: string;
      targetPath?: string;
      sourcePath?: string;
      sourcePaths?: string[];
      reason?: string;
    }>;
    ignore?: {
      source?: FormattedIgnoreExplanation;
      targetOutput?: FormattedIgnoreExplanation;
    };
    diagnostics?: HarnessInspection["diagnostics"];
    explanation: string;
  };
  const lines = [
    cliStyle(options, CLI_ANSI.bold, "Harness config explanation"),
    `${cliLabel(options, "Path:")} ${cliValue(options, value.path)}`,
    `${cliLabel(options, "Summary:")} ${value.explanation}`,
  ];
  if (value.sourceRoot) {
    lines.push(
      `${cliLabel(options, "Source root:")} ${cliValue(
        options,
        `${value.sourceRoot.kind}[${value.sourceRoot.index}] ${value.sourceRoot.path}`
      )}`
    );
  }
  for (const action of value.outputActions ?? []) {
    lines.push(
      `${cliLabel(options, "Output action:")} ${action.kind} in ${
        action.target ?? "target"
      }${
        action.sourcePath
          ? ` <- ${displayRepoPath(toRepoRelative(value.root, action.sourcePath))}`
          : ""
      }${action.reason ? ` (${action.reason})` : ""}`
    );
  }
  for (const action of value.dirActions ?? []) {
    lines.push(
      `${cliLabel(options, "Dir action:")} ${action.kind} ${
        action.outputKind
      } from ${action.sourcePaths.length} source file${
        action.sourcePaths.length === 1 ? "" : "s"
      }${action.reason ? ` (${action.reason})` : ""}`
    );
  }
  for (const action of value.sourceActions ?? []) {
    lines.push(
      `${cliLabel(options, "Source use:")} ${action.kind}${
        action.target ? ` for ${action.target}` : ""
      }${action.reason ? ` (${action.reason})` : ""}`
    );
  }
  for (const [label, explanation] of [
    ["Source ignore", value.ignore?.source],
    ["Output ignore", value.ignore?.targetOutput],
  ] as const) {
    if (!explanation?.finalMatch) {
      continue;
    }
    lines.push(
      `${cliLabel(options, `${label}:`)} ${
        explanation.ignored ? "ignored" : "included"
      } by ${explanation.finalMatch.sourcePath}:${
        explanation.finalMatch.sourceLine
      } (${explanation.finalMatch.pattern})`
    );
  }
  const diagnostics = (value.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.severity === "error"
  );
  if (diagnostics.length > 0) {
    lines.push("", cliStyle(options, CLI_ANSI.bold, "Blocking diagnostics:"));
    lines.push(formatDiagnostics(diagnostics, options));
  }
  return lines.join("\n");
}

async function formatBareCommandGuidance(
  inspection: HarnessInspection,
  configPath: string | undefined,
  options: HarnessFormatOptions
): Promise<string> {
  const hasErrors = inspection.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error"
  );
  const configLine = inspection.hasHarnessConfig
    ? `${cliLabel(options, "Detected config:")} ${cliValue(
        options,
        toRepoRelative(inspection.root, inspection.paths.configPath)
      )}`
    : `${cliLabel(options, "Detected config:")} ${cliStyle(
        options,
        CLI_ANSI.yellow,
        "none"
      )}`;
  const sourceStats = await collectSourceStats(inspection);
  const projectionStatus = await formatProjectionStatus(
    inspection,
    configPath,
    options
  );
  const summary = sourceStats
    ? [
        cliStyle(options, CLI_ANSI.bold, "Summary:"),
        `  ${cliLabel(options, "Targets:")} ${cliValue(
          options,
          plural(sourceStats.targetCount, "target")
        )}`,
        `  ${cliLabel(options, "Resource files:")} ${cliValue(
          options,
          plural(sourceStats.resourceFiles, "file")
        )} across ${cliValue(
          options,
          plural(sourceStats.resourceKinds, "kind")
        )}`,
        `  ${cliLabel(options, "Composable files:")} ${cliValue(
          options,
          String(sourceStats.composableFiles)
        )}`,
        `  ${cliLabel(options, "Dir source:")} ${cliValue(
          options,
          sourceStats.dirPaths.length > 0
            ? sourceStats.dirPaths.map(displayRepoPath).join(", ")
            : "not declared"
        )}`,
        projectionStatus,
      ]
        .filter(Boolean)
        .join("\n")
    : projectionStatus
      ? `${cliStyle(options, CLI_ANSI.bold, "Summary:")}\n  ${projectionStatus}`
      : "";
  const summaryBlock = summary ? `\n\n${summary}` : "";
  const nextSteps = cliStyle(options, CLI_ANSI.bold, "Next steps:");
  const command = (value: string) => cliValue(options, value);

  if (hasErrors) {
    return `${configLine}${summaryBlock}\n\n${nextSteps}\n  ${command(
      "harnessc validate --json"
    )}  Inspect paths and issue details\n  ${command(
      "harnessc --help"
    )}           Show all commands`;
  }

  if (!inspection.hasHarnessConfig) {
    return `${configLine}${summaryBlock}\n\n${nextSteps}\n  ${command(
      "harnessc init"
    )}        Preview the default .harness setup\n  ${command(
      "harnessc init --yes"
    )}  Create .harness/harness.toml and .harnessIgnore\n  ${command(
      "harnessc --help"
    )}      Show all commands`;
  }

  return `${configLine}${summaryBlock}\n\n${nextSteps}\n  ${command(
    "harnessc activate"
  )}        Preview projected file changes\n  ${command(
    "harnessc activate --yes"
  )}  Apply the projection\n  ${command(
    "harnessc validate --json"
  )} Inspect paths and selected config`;
}

function initOptionsFromCli(
  options: Pick<CliOptions, "resources" | "resourcesPath" | "targets">
): {
  config?: HarnessConfig;
  resourceKinds?: string[];
  resourcesPath?: string;
} {
  const resourceKinds =
    options.resources.length > 0
      ? options.resources
      : [...CONVENTIONAL_HARNESS_RESOURCES];
  if (options.targets.length === 0) {
    return { resourceKinds, resourcesPath: options.resourcesPath };
  }

  const base = createDefaultHarnessConfig();
  return {
    config: harnessConfigSchema.parse({
      ...base,
      resources: options.resourcesPath
        ? [{ path: options.resourcesPath }]
        : base.resources.length > 0
          ? base.resources
          : [{ path: "./.harness/resources" }],
      targets: options.targets.map((target) => ({ path: target })),
    }),
    resourceKinds,
    resourcesPath: options.resourcesPath,
  };
}

function hasUnmanagedEntries(plan: HarnessActivationPlan): boolean {
  return plan.targets.some((target) =>
    target.actions.some((action) => action.kind === "preserve")
  );
}

function hasMutableEntries(plan: HarnessActivationPlan): boolean {
  return plan.targets.some((target) =>
    target.actions.some((action) => action.kind === "mutable")
  );
}

function formatOptionsForCli(
  options: Pick<CliOptions, "json">,
  io: CliIo
): HarnessFormatOptions {
  if (options.json) {
    return { color: false };
  }
  const forceColor = processEnv.FORCE_COLOR;
  if (forceColor && forceColor !== "0") {
    return { color: true };
  }
  if (processEnv.NO_COLOR !== undefined) {
    return { color: false };
  }
  return { color: io.supportsColor === true };
}

async function promptCleanupUnmanaged(): Promise<"keep" | "remove"> {
  if (!(processStdin.isTTY && processStdout.isTTY)) {
    return "keep";
  }

  const prompt = createInterface({
    input: processStdin,
    output: processStdout,
  });
  try {
    const answer = await prompt.question(
      "Unmanaged target entries were found. Remove entries not present in .harness during activation? [y/N] "
    );
    return answer.trim().toLowerCase().startsWith("y") ? "remove" : "keep";
  } finally {
    prompt.close();
  }
}

export async function runHarnessConfigCli(
  argv = process.argv.slice(2),
  io = DEFAULT_IO
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    io.stderr(HELP);
    return 1;
  }

  if (options.help) {
    io.stdout(HELP);
    return 0;
  }

  if (!options.rootExplicit && !options.configPath) {
    options.root = await discoverHarnessRoot(options.root);
  }

  const formatOptions = formatOptionsForCli(options, io);

  try {
    if (options.command === "validate") {
      const inspection = await validateHarnessConfig(options.root, {
        configPath: options.configPath,
      });
      const diagnostics = options.json
        ? JSON.stringify(inspection, null, 2)
        : formatDiagnostics(inspection.diagnostics, formatOptions);
      io.stdout(
        !options.commandExplicit && !options.json
          ? `${diagnostics}\n\n${await formatBareCommandGuidance(
              inspection,
              options.configPath,
              formatOptions
            )}`
          : diagnostics
      );
      return inspection.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      )
        ? 1
        : 0;
    }

    if (options.command === "explain") {
      if (!options.explainPath) {
        throw new Error("harnessc explain requires a path.");
      }
      const explanation = await explainHarnessPath(
        options.root,
        options.configPath,
        options.explainPath,
        formatOptions
      );
      io.stdout(
        options.json
          ? JSON.stringify(explanation, null, 2)
          : formatExplainResult(explanation, formatOptions)
      );
      return 0;
    }

    if (options.command === "plan") {
      const plan = await planHarnessInitialization(options.root, {
        configPath: options.configPath,
        ...initOptionsFromCli(options),
      });
      io.stdout(
        options.json
          ? JSON.stringify(plan, null, 2)
          : formatInitializationPlan(plan, formatOptions)
      );
      return 0;
    }

    if (options.command === "activate") {
      let cleanupUnmanaged = options.cleanupUnmanaged;
      let mutableNotice = "";
      const autoExtensionPlan = await planRegisteredExtensions(options.root, {
        autoOnly: true,
        configPath: options.configPath,
      });
      const autoExtensionHasOutput =
        hasExtensionActivationOutput(autoExtensionPlan);
      const autoExtensionHasErrors =
        hasExtensionActivationErrors(autoExtensionPlan);
      if (options.yes && autoExtensionHasErrors) {
        io.stdout(
          formatExtensionActivationPlan(autoExtensionPlan, formatOptions)
        );
        return 1;
      }
      if (options.yes && !options.json) {
        const promptPlan = await planHarnessActivation(options.root, {
          configPath: options.configPath,
          cleanupUnmanaged: cleanupUnmanaged ?? "keep",
          mutablePolicy: options.mutablePolicy,
          targetSymlinkPolicy: options.targetSymlinkPolicy,
        });
        if (!cleanupUnmanaged && hasUnmanagedEntries(promptPlan)) {
          cleanupUnmanaged = await promptCleanupUnmanaged();
        }
        if (
          options.mutablePolicy !== "force" &&
          hasMutableEntries(promptPlan)
        ) {
          mutableNotice =
            "\nNotice: mutable target files were left as-is. Re-run with --force-mutable to re-project them from configured sources.";
        }
      }

      const result = await applyHarnessActivation(options.root, {
        configPath: options.configPath,
        dryRun: options.dryRun || !options.yes,
        yes: options.yes,
        cleanupUnmanaged,
        mutablePolicy: options.mutablePolicy,
        targetSymlinkPolicy: options.targetSymlinkPolicy,
      });
      const extensionResult = autoExtensionHasOutput
        ? await applyRegisteredExtensions(options.root, {
            autoOnly: true,
            configPath: options.configPath,
            dryRun: options.dryRun || !options.yes,
            yes: options.yes,
          })
        : undefined;
      const formatted = options.json
        ? JSON.stringify(
            extensionResult
              ? { activation: result, extensions: extensionResult }
              : result,
            null,
            2
          )
        : `${formatActivationResult(result, formatOptions)}${
            extensionResult
              ? `\n\n${formatExtensionActivationResult(
                  extensionResult,
                  formatOptions
                )}`
              : ""
          }${mutableNotice}`;
      io.stdout(formatted);
      return result.plan.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      ) ||
        (extensionResult
          ? hasExtensionActivationErrors(extensionResult.plan)
          : false)
        ? 1
        : 0;
    }

    if (options.command === "extension activate") {
      const result = await applyRegisteredExtensions(options.root, {
        allExtensions: options.allExtensions,
        configPath: options.configPath,
        dryRun: options.dryRun || !options.yes,
        extensionIds: options.extensions,
        yes: options.yes,
      });
      io.stdout(
        options.json
          ? JSON.stringify(result, null, 2)
          : formatExtensionActivationResult(result, formatOptions)
      );
      return hasExtensionActivationErrors(result.plan) ? 1 : 0;
    }

    if (options.command === "init") {
      const result = await applyHarnessInitialization(options.root, {
        configPath: options.configPath,
        dryRun: options.dryRun || !options.yes,
        yes: options.yes,
        ...initOptionsFromCli(options),
      });
      io.stdout(
        options.json
          ? JSON.stringify(result, null, 2)
          : formatInitializationResult(result, formatOptions)
      );
      return 0;
    }

    io.stderr(`Unknown command: ${options.command}`);
    io.stderr(HELP);
    return 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    if (options.command === "init") {
      const plan = await planHarnessInitialization(options.root, {
        configPath: options.configPath,
      });
      io.stderr(formatInitializationPlan(plan, formatOptions));
    }
    if (options.command === "activate") {
      const plan = await planHarnessActivation(options.root, {
        configPath: options.configPath,
        cleanupUnmanaged: options.cleanupUnmanaged,
        mutablePolicy: options.mutablePolicy,
        targetSymlinkPolicy: options.targetSymlinkPolicy,
      });
      io.stderr(formatActivationPlan(plan, formatOptions));
    }
    if (options.command === "extension activate") {
      const result = await applyRegisteredExtensions(options.root, {
        allExtensions: options.allExtensions,
        configPath: options.configPath,
        dryRun: true,
        extensionIds: options.extensions,
        yes: false,
      });
      io.stderr(formatExtensionActivationResult(result, formatOptions));
    }
    return 1;
  }
}
