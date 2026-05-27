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
  allExtensions: boolean;
  extensions: string[];
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
  harnessc init [--root <path>] [--config <path>] [--resources-path <path>]
                [--dry-run] [--yes] [--resource <kind>] [--target <path>]
  harnessc activate [--root <path>] [--dry-run] [--yes]
                    [--config <path>]
                    [--keep-unmanaged|--remove-unmanaged]
                    [--force-mutable] [--json]
  harnessc extension activate [--root <path>] [--config <path>]
                              [--dry-run] [--yes]
                              [--extension <id>|--all] [--json]
  harnessc plan [--root <path>] [--config <path>] [--resources-path <path>]
                [--resource <kind>] [--target <path>] [--json]

Commands:
  validate    Validate the repository against the Harness config standard.
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
Declaring [dir] in the manifest turns on the dir source root (default
./.harness/dir): a folder that contains a
.harnessComposable marker file is composed from its numbered parts into a
single output file, and any other folder copies its files to the matching
repo-relative paths.

Activation without --yes is the projection preview. Activation keeps unmanaged
target entries by default. Use --remove-unmanaged to delete target entries that
are not present in the computed Harness config projection. Managed target edits are
overwritten from configured sources on update. Mutable target files declared under
[mutable] in .harnessIgnore are created once and then left alone; use
--force-mutable to re-project them from source. Extensions are activated
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
  dirPath?: string;
};

function plural(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function displayRepoPath(repoPath: string): string {
  return repoPath.replaceAll("\\", "/").replace(/^\.\//, "");
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
  const resources = await countFilesAndComposables(paths.resourcesDir);
  const dir = config.dir
    ? await countFilesAndComposables(path.resolve(paths.root, config.dir.path))
    : { files: 0, composables: 0 };

  return {
    targetCount: config.targets.length,
    resourceFiles: resources.files,
    resourceKinds: await countResourceKinds(paths.resourcesDir),
    composableFiles: resources.composables + dir.composables,
    dirPath: config.dir?.path,
  };
}

async function formatProjectionStatus(
  inspection: HarnessInspection,
  configPath?: string
): Promise<string | undefined> {
  if (!inspection.hasHarnessConfig) {
    return undefined;
  }
  const plan = await planHarnessActivation(inspection.root, {
    configPath,
  }).catch(() => undefined);
  if (!plan) {
    return "Projection: blocked - inspect issues before activation";
  }
  if (plan.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "Projection: blocked - fix issues before activation";
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
    return "Projection: clean - no pending writes";
  }

  return `Projection: dirty - create ${create}, update ${update}, remove ${remove}`;
}

async function formatBareCommandGuidance(
  inspection: HarnessInspection,
  configPath?: string
): Promise<string> {
  const hasErrors = inspection.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error"
  );
  const configLine = inspection.hasHarnessConfig
    ? `Detected config: ${toRepoRelative(
        inspection.root,
        inspection.paths.configPath
      )}`
    : "Detected config: none";
  const sourceStats = await collectSourceStats(inspection);
  const projectionStatus = await formatProjectionStatus(inspection, configPath);
  const summary = sourceStats
    ? [
        "Summary:",
        `  Targets: ${plural(sourceStats.targetCount, "target")}`,
        `  Resource files: ${plural(
          sourceStats.resourceFiles,
          "file"
        )} across ${plural(sourceStats.resourceKinds, "kind")}`,
        `  Composable files: ${sourceStats.composableFiles}`,
        `  Dir source: ${
          sourceStats.dirPath
            ? displayRepoPath(sourceStats.dirPath)
            : "not declared"
        }`,
        projectionStatus,
      ]
        .filter(Boolean)
        .join("\n")
    : projectionStatus
      ? `Summary:\n  ${projectionStatus}`
      : "";
  const summaryBlock = summary ? `\n\n${summary}` : "";

  if (hasErrors) {
    return `${configLine}${summaryBlock}\n\nNext steps:\n  harnessc validate --json  Inspect paths and issue details\n  harnessc --help           Show all commands`;
  }

  if (!inspection.hasHarnessConfig) {
    return `${configLine}${summaryBlock}\n\nNext steps:\n  harnessc init        Preview the default .harness setup\n  harnessc init --yes  Create .harness/harness.toml and .harnessIgnore\n  harnessc --help      Show all commands`;
  }

  return `${configLine}${summaryBlock}\n\nNext steps:\n  harnessc activate        Preview projected file changes\n  harnessc activate --yes  Apply the projection\n  harnessc validate --json Inspect paths and selected config`;
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
        ? { path: options.resourcesPath }
        : base.resources,
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
              options.configPath
            )}`
          : diagnostics
      );
      return inspection.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      )
        ? 1
        : 0;
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
