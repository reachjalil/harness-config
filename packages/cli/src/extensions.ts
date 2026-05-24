import { readFile } from "node:fs/promises";

import {
  dirExtension,
  type DirExtensionPlan,
  type DirExtensionResult,
} from "@harnessconfig/extension-dir";
import {
  CURRENT_HARNESS_CONFIG_VERSION,
  formatDiagnostics,
  parseHarnessConfigToml,
  resolveHarnessPaths,
  toRepoRelative,
} from "@harnessconfig/core";
import type {
  HarnessConfig,
  HarnessDiagnostic,
  HarnessExtensionDefinition,
} from "@harnessconfig/core";

const REGISTERED_EXTENSIONS = [dirExtension] as const;

type RegisteredExtensionId = (typeof REGISTERED_EXTENSIONS)[number]["id"];
type RegisteredExtensionPlan = DirExtensionPlan;
type RegisteredExtensionResult = DirExtensionResult;

export type ExtensionActivationSelection = {
  allExtensions?: boolean;
  autoOnly?: boolean;
  extensionIds?: string[];
};

export type ExtensionActivationPlan = {
  root: string;
  selected: Array<{
    id: RegisteredExtensionId;
    config: HarnessExtensionDefinition;
    plan: RegisteredExtensionPlan;
  }>;
  diagnostics: HarnessDiagnostic[];
};

export type ExtensionActivationResult = {
  root: string;
  dryRun: boolean;
  plan: ExtensionActivationPlan;
  results: Array<{
    id: RegisteredExtensionId;
    result: RegisteredExtensionResult;
  }>;
};

function registeredExtension(id: string) {
  return REGISTERED_EXTENSIONS.find((extension) => extension.id === id);
}

async function loadHarnessConfig(
  root: string,
  diagnostics: HarnessDiagnostic[]
): Promise<HarnessConfig | undefined> {
  const configPath = resolveHarnessPaths(root).configPath;
  const raw = await readFile(configPath, "utf8").catch((error: unknown) => {
    diagnostics.push({
      severity: "error",
      code: "harness.extension_config_unavailable",
      message: error instanceof Error ? error.message : String(error),
      path: toRepoRelative(root, configPath),
      recommendation:
        "Create a valid .harness/harness.toml before running extensions.",
    });
    return undefined;
  });
  if (raw === undefined) {
    return undefined;
  }

  try {
    return parseHarnessConfigToml(raw);
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "harness.extension_config_invalid",
      message: error instanceof Error ? error.message : String(error),
      path: toRepoRelative(root, configPath),
      recommendation:
        "Update harness.toml before running extension activation.",
    });
    return undefined;
  }
}

function selectExtensionIds(
  config: HarnessConfig,
  selection: ExtensionActivationSelection,
  diagnostics: HarnessDiagnostic[]
): string[] {
  const extensionIds = selection.extensionIds ?? [];
  if (selection.allExtensions && extensionIds.length > 0) {
    diagnostics.push({
      severity: "error",
      code: "harness.extension_selection_conflict",
      message: "Use either --all or --extension, not both.",
    });
    return [];
  }

  if (extensionIds.length > 0) {
    return extensionIds;
  }

  const declared = Object.entries(config.extensions);
  if (selection.allExtensions) {
    return declared.map(([id]) => id);
  }

  return declared
    .filter(([, definition]) => definition.activation === "auto")
    .map(([id]) => id);
}

function validateSelectedExtension(
  config: HarnessConfig,
  id: string,
  diagnostics: HarnessDiagnostic[]
):
  | { id: RegisteredExtensionId; config: HarnessExtensionDefinition }
  | undefined {
  const extensionConfig = config.extensions[id];
  if (!extensionConfig) {
    diagnostics.push({
      severity: "error",
      code: "harness.extension_undeclared",
      message: `Extension "${id}" is not declared in harness.toml.`,
      path: `extensions.${id}`,
      recommendation: "Declare the extension before selecting it.",
    });
    return undefined;
  }

  const extension = registeredExtension(id);
  if (!extension) {
    diagnostics.push({
      severity: "error",
      code: "harness.extension_unsupported",
      message: `Extension "${id}" is not supported by this harnessc build.`,
      path: `extensions.${id}`,
    });
    return undefined;
  }

  if (
    !extension.compatibleHarnessVersions.includes(
      CURRENT_HARNESS_CONFIG_VERSION
    )
  ) {
    diagnostics.push({
      severity: "error",
      code: "harness.extension_incompatible",
      message: `Extension "${id}" is not compatible with HarnessConfig version ${CURRENT_HARNESS_CONFIG_VERSION}.`,
      path: `extensions.${id}`,
    });
    return undefined;
  }

  if (
    !extension.configVersions.some(
      (version) => version === extensionConfig.version
    )
  ) {
    diagnostics.push({
      severity: "error",
      code: "harness.extension_config_version_unsupported",
      message: `Extension "${id}" does not support config version ${extensionConfig.version}.`,
      path: `extensions.${id}.version`,
    });
    return undefined;
  }

  return { id: extension.id, config: extensionConfig };
}

export function hasExtensionActivationErrors(
  plan: ExtensionActivationPlan
): boolean {
  return (
    plan.diagnostics.some((diagnostic) => diagnostic.severity === "error") ||
    plan.selected.some((selected) =>
      selected.plan.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      )
    )
  );
}

export function hasExtensionActivationOutput(
  plan: ExtensionActivationPlan
): boolean {
  return plan.diagnostics.length > 0 || plan.selected.length > 0;
}

export async function planRegisteredExtensions(
  root: string,
  selection: ExtensionActivationSelection = {}
): Promise<ExtensionActivationPlan> {
  const diagnostics: HarnessDiagnostic[] = [];
  const config = await loadHarnessConfig(root, diagnostics);
  const selected: ExtensionActivationPlan["selected"] = [];

  if (!config) {
    return { root, selected, diagnostics };
  }

  const selectedIds = selectExtensionIds(config, selection, diagnostics);
  for (const id of selectedIds) {
    const selectedExtension = validateSelectedExtension(
      config,
      id,
      diagnostics
    );
    if (!selectedExtension) {
      continue;
    }
    const extension = registeredExtension(selectedExtension.id);
    if (!extension) {
      continue;
    }
    selected.push({
      id: selectedExtension.id,
      config: selectedExtension.config,
      plan: await extension.plan(root, {
        config: selectedExtension.config,
        harnessConfig: config,
      }),
    });
  }

  return { root, selected, diagnostics };
}

export async function applyRegisteredExtensions(
  root: string,
  options: ExtensionActivationSelection & {
    dryRun?: boolean;
    yes?: boolean;
  } = {}
): Promise<ExtensionActivationResult> {
  const plan = await planRegisteredExtensions(root, options);
  const dryRun = options.dryRun === true || options.yes !== true;
  const results: ExtensionActivationResult["results"] = [];

  if (dryRun || hasExtensionActivationErrors(plan)) {
    return {
      root,
      dryRun,
      plan,
      results,
    };
  }

  const configDiagnostics: HarnessDiagnostic[] = [];
  const config = await loadHarnessConfig(root, configDiagnostics);
  if (!config) {
    return {
      root,
      dryRun: false,
      plan: {
        ...plan,
        diagnostics: [...plan.diagnostics, ...configDiagnostics],
      },
      results,
    };
  }

  for (const selected of plan.selected) {
    const extension = registeredExtension(selected.id);
    if (!extension) {
      continue;
    }
    results.push({
      id: selected.id,
      result: await extension.apply(root, {
        config: selected.config,
        dryRun: false,
        harnessConfig: config,
        yes: true,
      }),
    });
  }

  return {
    root,
    dryRun: false,
    plan,
    results,
  };
}

export function formatExtensionActivationPlan(
  plan: ExtensionActivationPlan
): string {
  const diagnostics = formatDiagnostics(plan.diagnostics);
  const extensionPlans =
    plan.selected.length === 0
      ? "No extensions selected."
      : plan.selected
          .map((selected) => {
            const extension = registeredExtension(selected.id);
            return extension
              ? extension.formatPlan(selected.plan)
              : `Unsupported extension ${selected.id}`;
          })
          .join("\n\n");

  return `HarnessConfig extension activation plan\n\nDiagnostics:\n${diagnostics}\n\nExtensions:\n${extensionPlans}`;
}

export function formatExtensionActivationResult(
  result: ExtensionActivationResult
): string {
  const extensionResults =
    result.results.length === 0
      ? "No extension file changes applied."
      : result.results
          .map(({ id, result }) => {
            const extension = registeredExtension(id);
            return extension
              ? extension.formatResult(result)
              : `Unsupported extension ${id}`;
          })
          .join("\n\n");

  return `HarnessConfig extension activation ${
    result.dryRun ? "dry run" : "result"
  }\n\n${formatExtensionActivationPlan(
    result.plan
  )}\n\nApplied:\n${extensionResults}`;
}
