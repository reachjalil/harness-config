import { stdin as processStdin, stdout as processStdout } from "node:process";
import { createInterface } from "node:readline/promises";

import {
  applyHarnessActivation,
  applyHarnessTransition,
  formatActivationPlan,
  formatActivationResult,
  formatDiagnostics,
  formatTransitionPlan,
  formatTransitionResult,
  planHarnessActivation,
  planHarnessTransition,
  validateHarnessConfig,
} from "@harnessconfig/core";
import type { HarnessActivationPlan } from "@harnessconfig/core";

type CliOptions = {
  command: string;
  root: string;
  json: boolean;
  yes: boolean;
  dryRun: boolean;
  help: boolean;
  cleanupUnmanaged?: "keep" | "remove";
};

type CliIo = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

const DEFAULT_IO: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
};

const HELP = `harnessc

Usage:
  harnessc validate [--root <path>] [--json]
  harnessc plan [--root <path>] [--json]
  harnessc activate [--root <path>] [--dry-run] [--yes] [--keep-unmanaged|--remove-unmanaged] [--json]
  harnessc transition [--root <path>] [--dry-run] [--yes] [--json]
  harnessc init [--root <path>] [--dry-run] [--yes]

Commands:
  validate    Validate the repository against the HarnessConfig standard.
  plan        Show a read-only adoption plan.
  activate    Plan or apply idempotent .harness projections.
  transition  Plan or apply .harness transition actions.
  init        Plan or create .harness resource structure.

HarnessConfig standardizes .harness/skills, .harness/rules, .harness/plugins,
harness.toml target mappings, and .harnessIgnore projection boundaries.

Activation keeps unmanaged target entries by default. Use --remove-unmanaged to
delete target entries that are not present in the computed .harness projection.
Transition and init are dry runs unless --yes is supplied.
`;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "",
    root: process.cwd(),
    json: false,
    yes: false,
    dryRun: false,
    help: false,
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
    if (arg === "--root" || arg === "-C") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a path.`);
      }
      options.root = value;
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

function hasUnmanagedEntries(plan: HarnessActivationPlan): boolean {
  return plan.targets.some((target) =>
    target.actions.some((action) => action.kind === "preserve")
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
      const plan = await planHarnessTransition(options.root);
      io.stdout(
        options.json
          ? JSON.stringify(plan, null, 2)
          : formatTransitionPlan(plan)
      );
      return 0;
    }

    if (options.command === "activate") {
      let cleanupUnmanaged = options.cleanupUnmanaged;
      if (options.yes && !cleanupUnmanaged && !options.json) {
        const promptPlan = await planHarnessActivation(options.root, {
          cleanupUnmanaged: "keep",
        });
        if (hasUnmanagedEntries(promptPlan)) {
          cleanupUnmanaged = await promptCleanupUnmanaged();
        }
      }

      const result = await applyHarnessActivation(options.root, {
        dryRun: options.dryRun || !options.yes,
        yes: options.yes,
        cleanupUnmanaged,
      });
      io.stdout(
        options.json
          ? JSON.stringify(result, null, 2)
          : formatActivationResult(result)
      );
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
      });
      io.stderr(formatActivationPlan(plan));
    }
    return 1;
  }
}
