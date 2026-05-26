import {
  env as processEnv,
  stdin as processStdin,
  stdout as processStdout,
} from "node:process";
import { createInterface } from "node:readline/promises";

import {
  applyHarnessActivation,
  applyHarnessInitialization,
  createDefaultHarnessConfig,
  defaultHarnessResourcePath,
  formatActivationPlan,
  formatActivationResult,
  formatDiagnostics,
  formatInitializationPlan,
  formatInitializationResult,
  harnessConfigSchema,
  planHarnessActivation,
  planHarnessInitialization,
  validateHarnessConfig,
} from "@harnessconfig/core";
import type {
  HarnessActivationPlan,
  HarnessConfig,
  HarnessFormatOptions,
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
  root: string;
  json: boolean;
  yes: boolean;
  dryRun: boolean;
  help: boolean;
  cleanupUnmanaged?: "keep" | "remove";
  mutablePolicy?: "skip" | "force";
  allExtensions: boolean;
  extensions: string[];
  resources: string[];
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
  harnessc validate [--root <path>] [--json]
  harnessc init [--root <path>] [--dry-run] [--yes] [--resource <kind>] [--target <path>]
  harnessc activate [--root <path>] [--dry-run] [--yes]
                    [--keep-unmanaged|--remove-unmanaged]
                    [--force-mutable] [--json]
  harnessc extension activate [--root <path>] [--dry-run] [--yes]
                              [--extension <id>|--all] [--json]
  harnessc plan [--root <path>] [--resource <kind>] [--target <path>] [--json]

Commands:
  validate    Validate the repository against the HarnessConfig standard.
  init        Plan or create .harness resource structure.
  activate    Plan or apply idempotent .harness projections.
  extension   Plan or apply registered HarnessConfig extensions.
  plan        Show a read-only initialization/adoption plan, not a projection preview.

HarnessConfig standardizes the .harness/<kind>/<name> resource shape,
harness.toml resource and target declarations, and .harnessIgnore projection
boundaries. Init uses skills, rules, and plugins as conventional resource
roots unless --resource is supplied. Targets are explicit repo-local paths
declared with --target. Declaring [dir] in harness.toml turns on the dir
source root (default ./.harness/dir): a folder that contains a
.harnessComposable marker file is composed from its numbered parts into a
single output file, and any other folder copies its files to the matching
repo-relative paths.

Activation without --yes is the projection preview. Activation keeps unmanaged
target entries by default. Use --remove-unmanaged to delete target entries that
are not present in the computed .harness projection. Managed target edits are
overwritten from .harness on update. Mutable target files declared under
[mutable] in .harnessIgnore are created once and then left alone; use
--force-mutable to re-project them from source. Extensions are activated
separately with harnessc extension activate. Init, activate, and extension
activate are dry runs unless --yes is supplied.
`;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "",
    root: process.cwd(),
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
          index += 1;
          continue;
        }
      }
      options.command = arg;
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

function initConfigFromOptions(
  options: Pick<CliOptions, "resources" | "targets">
): HarnessConfig | undefined {
  if (options.resources.length === 0 && options.targets.length === 0) {
    return undefined;
  }

  const base = createDefaultHarnessConfig();
  const resources =
    options.resources.length > 0
      ? Object.fromEntries(
          options.resources.map((resource) => [
            resource,
            {
              path: defaultHarnessResourcePath(resource),
            },
          ])
        )
      : base.resources;

  return harnessConfigSchema.parse({
    ...base,
    resources,
    targets: options.targets.map((target) => ({ path: target })),
  });
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

  const formatOptions = formatOptionsForCli(options, io);

  try {
    if (options.command === "validate") {
      const inspection = await validateHarnessConfig(options.root);
      io.stdout(
        options.json
          ? JSON.stringify(inspection, null, 2)
          : formatDiagnostics(inspection.diagnostics, formatOptions)
      );
      return inspection.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      )
        ? 1
        : 0;
    }

    if (options.command === "plan") {
      const plan = await planHarnessInitialization(options.root, {
        config: initConfigFromOptions(options),
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
            "\nNotice: mutable target files were left as-is. Re-run with --force-mutable to re-project them from .harness.";
        }
      }

      const result = await applyHarnessActivation(options.root, {
        dryRun: options.dryRun || !options.yes,
        yes: options.yes,
        cleanupUnmanaged,
        mutablePolicy: options.mutablePolicy,
      });
      const extensionResult = autoExtensionHasOutput
        ? await applyRegisteredExtensions(options.root, {
            autoOnly: true,
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
        dryRun: options.dryRun || !options.yes,
        yes: options.yes,
        config: initConfigFromOptions(options),
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
      const plan = await planHarnessInitialization(options.root);
      io.stderr(formatInitializationPlan(plan, formatOptions));
    }
    if (options.command === "activate") {
      const plan = await planHarnessActivation(options.root, {
        cleanupUnmanaged: options.cleanupUnmanaged,
        mutablePolicy: options.mutablePolicy,
      });
      io.stderr(formatActivationPlan(plan, formatOptions));
    }
    if (options.command === "extension activate") {
      const result = await applyRegisteredExtensions(options.root, {
        allExtensions: options.allExtensions,
        dryRun: true,
        extensionIds: options.extensions,
        yes: false,
      });
      io.stderr(formatExtensionActivationResult(result, formatOptions));
    }
    return 1;
  }
}
