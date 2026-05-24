import { lstat } from "node:fs/promises";
import path from "node:path";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { createInterface } from "node:readline/promises";

import {
  applyHarnessActivation,
  applyHarnessTransition,
  createDefaultHarnessConfig,
  defaultHarnessResourcePath,
  formatActivationPlan,
  formatActivationResult,
  formatDiagnostics,
  formatTransitionPlan,
  formatTransitionResult,
  harnessConfigSchema,
  planHarnessActivation,
  planHarnessTransition,
  validateHarnessConfig,
} from "@harnessconfig/core";
import type { HarnessActivationPlan, HarnessConfig } from "@harnessconfig/core";

type CliOptions = {
  command: string;
  root: string;
  json: boolean;
  yes: boolean;
  dryRun: boolean;
  help: boolean;
  cleanupUnmanaged?: "keep" | "remove";
  driftPolicy?: "report" | "accept";
  mutablePolicy?: "skip" | "force";
  resources: string[];
  targets: string[];
};

type CliIo = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

type KnownHarnessSurface = {
  id: string;
  path: string;
  purpose: string;
  exists: boolean;
};

const DEFAULT_IO: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
};

const KNOWN_HARNESS_SURFACES: Array<Omit<KnownHarnessSurface, "exists">> = [
  {
    id: "agents",
    path: "./.agents",
    purpose: "common agent activation surface",
  },
  {
    id: "claude",
    path: "./.claude",
    purpose: "Claude project configuration surface",
  },
  {
    id: "cursor",
    path: "./.cursor",
    purpose: "Cursor project configuration surface",
  },
  {
    id: "gemini",
    path: "./.gemini",
    purpose: "Gemini project configuration surface",
  },
];

const HELP = `harnessc

Usage:
  harnessc validate [--root <path>] [--json]
  harnessc plan [--root <path>] [--resource <kind>] [--target <path>] [--json]
  harnessc activate [--root <path>] [--dry-run] [--yes]
                    [--keep-unmanaged|--remove-unmanaged]
                    [--accept-drift] [--force-mutable] [--json]
  harnessc transition [--root <path>] [--dry-run] [--yes] [--resource <kind>] [--target <path>] [--json]
  harnessc init [--root <path>] [--dry-run] [--yes] [--resource <kind>] [--target <path>]

Commands:
  validate    Validate the repository against the HarnessConfig standard.
  plan        Show a read-only adoption plan.
  activate    Plan or apply idempotent .harness projections.
  transition  Plan or apply .harness transition actions.
  init        Plan or create .harness resource structure.

HarnessConfig standardizes the .harness/<kind>/<name> resource shape,
harness.toml resource and target declarations, and .harnessIgnore projection
boundaries. Init uses skills, rules, and plugins as conventional resource
roots unless --resource is supplied. Targets are explicit; .agents is just a
normal target when declared with --target ./.agents.

Activation keeps unmanaged target entries by default. Use --remove-unmanaged to
delete target entries that are not present in the computed .harness projection.
Drifted target files (modified after the last activation) are reported and
skipped; use --accept-drift to overwrite them with the source projection.
Mutable target files declared under [mutable] in .harnessIgnore are created
once and then left alone; use --force-mutable to re-project them from source.
Transition and init are dry runs unless --yes is supplied.
`;

async function knownHarnessSurfaces(
  root: string
): Promise<KnownHarnessSurface[]> {
  const absoluteRoot = path.resolve(root);
  return Promise.all(
    KNOWN_HARNESS_SURFACES.map(async (surface) => ({
      ...surface,
      exists: Boolean(
        (
          await lstat(path.resolve(absoluteRoot, surface.path)).catch(
            () => undefined
          )
        )?.isDirectory()
      ),
    }))
  );
}

function formatKnownHarnessSurfaceHints(
  surfaces: KnownHarnessSurface[]
): string {
  const existing = surfaces.filter((surface) => surface.exists);
  if (existing.length === 0) {
    return "";
  }

  return [
    "Known runtime surfaces found (reference implementation hint)",
    ...existing.map(
      (surface) =>
        `- ${surface.path}: ${surface.purpose}; declare [[targets]] path = "${surface.path}" if it should receive a projection.`
    ),
  ].join("\n");
}

function appendKnownHarnessSurfaceHints(
  output: string,
  surfaces: KnownHarnessSurface[]
): string {
  const hints = formatKnownHarnessSurfaceHints(surfaces);
  return hints ? `${output}\n\n${hints}` : output;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "",
    root: process.cwd(),
    json: false,
    yes: false,
    dryRun: false,
    help: false,
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
    if (arg === "--accept-drift") {
      options.driftPolicy = "accept";
      continue;
    }
    if (arg === "--force-mutable") {
      options.mutablePolicy = "force";
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

  return options;
}

function transitionConfigFromOptions(
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

function hasDriftEntries(plan: HarnessActivationPlan): boolean {
  return plan.targets.some((target) =>
    target.actions.some((action) => action.kind === "drift")
  );
}

function hasMutableEntries(plan: HarnessActivationPlan): boolean {
  return plan.targets.some((target) =>
    target.actions.some((action) => action.kind === "mutable")
  );
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

  try {
    if (options.command === "validate") {
      const inspection = await validateHarnessConfig(options.root);
      io.stdout(
        options.json
          ? JSON.stringify(inspection, null, 2)
          : formatDiagnostics(inspection.diagnostics)
      );
      return inspection.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      )
        ? 1
        : 0;
    }

    if (options.command === "plan") {
      const plan = await planHarnessTransition(options.root, {
        config: transitionConfigFromOptions(options),
      });
      const surfaces = await knownHarnessSurfaces(options.root);
      io.stdout(
        options.json
          ? JSON.stringify({ ...plan, knownSurfaces: surfaces }, null, 2)
          : appendKnownHarnessSurfaceHints(formatTransitionPlan(plan), surfaces)
      );
      return 0;
    }

    if (options.command === "activate") {
      let cleanupUnmanaged = options.cleanupUnmanaged;
      let driftNotice = "";
      let mutableNotice = "";
      if (options.yes && !options.json) {
        const promptPlan = await planHarnessActivation(options.root, {
          cleanupUnmanaged: cleanupUnmanaged ?? "keep",
          driftPolicy: options.driftPolicy,
          mutablePolicy: options.mutablePolicy,
        });
        if (!cleanupUnmanaged && hasUnmanagedEntries(promptPlan)) {
          cleanupUnmanaged = await promptCleanupUnmanaged();
        }
        if (options.driftPolicy !== "accept" && hasDriftEntries(promptPlan)) {
          driftNotice =
            "\nNotice: drifted target files were skipped. Re-run with --accept-drift to overwrite them from .harness.";
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
        driftPolicy: options.driftPolicy,
        mutablePolicy: options.mutablePolicy,
      });
      const formatted = options.json
        ? JSON.stringify(result, null, 2)
        : `${formatActivationResult(result)}${driftNotice}${mutableNotice}`;
      io.stdout(formatted);
      return result.plan.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      )
        ? 1
        : 0;
    }

    if (options.command === "transition" || options.command === "init") {
      const result = await applyHarnessTransition(options.root, {
        dryRun: options.dryRun || !options.yes,
        yes: options.yes,
        config: transitionConfigFromOptions(options),
      });
      io.stdout(
        options.json
          ? JSON.stringify(result, null, 2)
          : formatTransitionResult(result)
      );
      return 0;
    }

    io.stderr(`Unknown command: ${options.command}`);
    io.stderr(HELP);
    return 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    if (options.command === "transition") {
      const plan = await planHarnessTransition(options.root);
      io.stderr(formatTransitionPlan(plan));
    }
    if (options.command === "activate") {
      const plan = await planHarnessActivation(options.root, {
        cleanupUnmanaged: options.cleanupUnmanaged,
        driftPolicy: options.driftPolicy,
        mutablePolicy: options.mutablePolicy,
      });
      io.stderr(formatActivationPlan(plan));
    }
    return 1;
  }
}
