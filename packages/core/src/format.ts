import { toRepoRelative } from "./paths";
import type {
  HarnessActivationAction,
  HarnessActivationDirAction,
  HarnessActivationDirPlan,
  HarnessActivationPlan,
  HarnessActivationResult,
  HarnessDiagnostic,
  HarnessInitializationAction,
  HarnessInitializationPlan,
  HarnessInitializationResult,
} from "./types";

export type HarnessFormatOptions = {
  color?: boolean;
};

const ANSI = {
  blue: "\u001b[34m",
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  red: "\u001b[31m",
  reset: "\u001b[0m",
  yellow: "\u001b[33m",
};

function style(
  options: HarnessFormatOptions | undefined,
  code: string,
  text: string
): string {
  return options?.color ? `${code}${text}${ANSI.reset}` : text;
}

function heading(
  options: HarnessFormatOptions | undefined,
  text: string
): string {
  return style(options, ANSI.bold, text);
}

function severityPrefix(
  diagnostic: HarnessDiagnostic,
  options?: HarnessFormatOptions
): string {
  const prefix = diagnostic.severity.toUpperCase();
  if (diagnostic.severity === "error") {
    return style(options, `${ANSI.bold}${ANSI.red}`, prefix);
  }
  if (diagnostic.severity === "warning") {
    return style(options, ANSI.yellow, prefix);
  }
  return style(options, ANSI.cyan, prefix);
}

function actionKind(
  kind: HarnessActivationAction["kind"] | HarnessActivationDirAction["kind"],
  options?: HarnessFormatOptions
): string {
  switch (kind) {
    case "create":
      return style(options, ANSI.green, kind);
    case "update":
      return style(options, ANSI.yellow, kind);
    case "remove":
      return style(options, ANSI.red, kind);
    case "mutable":
      return style(options, ANSI.magenta, kind);
    case "preserve":
      return style(options, ANSI.blue, kind);
    case "keep":
      return style(options, ANSI.dim, kind);
    default:
      return kind;
  }
}

function formatActivationAction(
  root: string,
  action: HarnessActivationAction,
  options?: HarnessFormatOptions
): string {
  const target = toRepoRelative(root, action.targetPath);
  const source = action.sourcePath
    ? toRepoRelative(root, action.sourcePath)
    : "";
  const sourceDetails = source ? ` <- ${source}` : "";
  const reason = action.reason ? ` (${action.reason})` : "";
  return `${actionKind(action.kind, options)}: ${target}${sourceDetails}${reason}`;
}

function summarizeDirActions(actions: HarnessActivationDirAction[]): string {
  const counts = { create: 0, update: 0, keep: 0 };
  for (const action of actions) {
    counts[action.kind] += 1;
  }
  return `create ${counts.create}, update ${counts.update}, keep ${counts.keep}`;
}

function formatDirAction(
  root: string,
  action: HarnessActivationDirAction,
  options?: HarnessFormatOptions
): string {
  const target = toRepoRelative(root, action.targetPath);
  const source =
    action.sourcePaths.length === 0
      ? "empty"
      : `${action.sourcePaths.length} ${action.outputKind} source file${
          action.sourcePaths.length === 1 ? "" : "s"
        }`;
  const reason = action.reason ? ` (${action.reason})` : "";
  return `${actionKind(action.kind, options)}: ${target} <- ${source}${reason}`;
}

function formatDirPlanSection(
  root: string,
  dir: HarnessActivationDirPlan,
  options?: HarnessFormatOptions
): string {
  if (!dir.enabled) {
    return `${heading(
      options,
      "Dir composition:"
    )}\n[dir] is not declared; no dir composition or copy.`;
  }
  const header = heading(
    options,
    `Dir composition (source ${dir.path ?? "./.harness/dir"}):`
  );
  if (dir.actions.length === 0) {
    return `${header}\nNo repo-root dir outputs. Dir outputs targeting declared [[targets]] paths are merged into those target plans above.`;
  }
  const summary = `Summary: ${summarizeDirActions(dir.actions)}`;
  const sections: Array<{
    title: string;
    kinds: HarnessActivationDirAction["kind"][];
    limit: number;
  }> = [
    { title: "Creates", kinds: ["create"], limit: 12 },
    { title: "Updates", kinds: ["update"], limit: 12 },
    { title: "Dir outputs already matching", kinds: ["keep"], limit: 8 },
  ];
  const body = sections
    .map((section) => {
      const sectionActions = dir.actions.filter((action) =>
        section.kinds.includes(action.kind)
      );
      if (sectionActions.length === 0) {
        return "";
      }
      const visibleActions = sectionActions.slice(0, section.limit);
      const lines = visibleActions.map(
        (action) => `  - ${formatDirAction(root, action, options)}`
      );
      const remaining = sectionActions.length - visibleActions.length;
      if (remaining > 0) {
        lines.push(`  - ... ${remaining} more`);
      }
      return `${heading(options, section.title)}\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n");
  return `${header}\n${summary}\n${body}`;
}

export function formatActivationPlan(
  plan: HarnessActivationPlan,
  options: HarnessFormatOptions = {}
): string {
  const diagnostics = formatDiagnostics(plan.diagnostics, options);
  const targets =
    plan.targets.length === 0
      ? "No activation targets."
      : plan.targets
          .map((target) => {
            const summary = summarizeActivationActions(target.actions);
            const policies = [
              target.actions.some((action) => action.kind === "preserve")
                ? "Unmanaged policy: keeping existing target entries that are not in configured sources. Use --remove-unmanaged to delete them."
                : "",
              target.actions.some((action) => action.kind === "mutable")
                ? "Mutable policy: leaving runtime-owned files in place. Use --force-mutable to re-project from source."
                : "",
            ]
              .filter(Boolean)
              .map((line) => `\n${line}`)
              .join("");
            const actions =
              target.actions.length === 0
                ? "  No file changes."
                : formatActivationActionSections(
                    plan.root,
                    target.actions,
                    options
                  );
            return `${heading(
              options,
              `${target.path} (${target.strategy}, override ${target.override})`
            )}\nSummary: ${summary}${policies}\n${actions}`;
          })
          .join("\n\n");

  const dirSection = formatDirPlanSection(plan.root, plan.dir, options);

  return `${heading(options, "Harness config activation plan")}\n\n${heading(
    options,
    "Idempotency:"
  )}\nRunning activation with the same configured source trees, manifest, and .harnessIgnore files produces the same projections.\n\n${heading(
    options,
    "Diagnostics:"
  )}\n${diagnostics}\n\n${heading(
    options,
    "Targets:"
  )}\n${targets}\n\n${dirSection}`;
}

function summarizeActivationActions(
  actions: HarnessActivationAction[]
): string {
  const counts = {
    create: 0,
    update: 0,
    remove: 0,
    keep: 0,
    preserve: 0,
    mutable: 0,
  };
  for (const action of actions) {
    counts[action.kind] += 1;
  }

  return [
    `create ${counts.create}`,
    `update ${counts.update}`,
    `mutable ${counts.mutable}`,
    `remove ${counts.remove}`,
    `keep ${counts.keep}`,
    `preserve unmanaged ${counts.preserve}`,
  ].join(", ");
}

function formatActivationActionSections(
  root: string,
  actions: HarnessActivationAction[],
  options?: HarnessFormatOptions
): string {
  const sections: Array<{
    title: string;
    kinds: HarnessActivationAction["kind"][];
    limit: number;
  }> = [
    { title: "Creates", kinds: ["create"], limit: 12 },
    {
      title:
        "Updates (managed target files overwritten from configured sources)",
      kinds: ["update"],
      limit: 12,
    },
    {
      title: "Mutable target files (runtime-owned, left untouched)",
      kinds: ["mutable"],
      limit: 12,
    },
    { title: "Removals", kinds: ["remove"], limit: 12 },
    { title: "Projected files already matching", kinds: ["keep"], limit: 8 },
    {
      title: "Unmanaged target entries kept",
      kinds: ["preserve"],
      limit: 8,
    },
  ];

  return sections
    .map((section) => {
      const sectionActions = actions.filter((action) =>
        section.kinds.includes(action.kind)
      );
      if (sectionActions.length === 0) {
        return "";
      }
      const visibleActions = sectionActions.slice(0, section.limit);
      const lines = visibleActions.map(
        (action) => `  - ${formatActivationAction(root, action, options)}`
      );
      const remaining = sectionActions.length - visibleActions.length;
      if (remaining > 0) {
        lines.push(`  - ... ${remaining} more`);
      }
      return `${heading(options, section.title)}\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function formatActivationResult(
  result: HarnessActivationResult,
  options: HarnessFormatOptions = {}
): string {
  const applied =
    result.appliedActions.length === 0
      ? "No file changes applied."
      : result.appliedActions
          .map((action) => formatActivationAction(result.root, action, options))
          .join("\n");
  const dirApplied =
    result.appliedDirActions.length === 0
      ? "No dir file changes applied."
      : result.appliedDirActions
          .map((action) => formatDirAction(result.root, action, options))
          .join("\n");

  return `${heading(
    options,
    `Harness config activation ${result.dryRun ? "dry run" : "result"}`
  )}\n\n${formatActivationPlan(result.plan, options)}\n\n${heading(
    options,
    "Applied:"
  )}\n${applied}\n\n${heading(options, "Applied dir outputs:")}\n${dirApplied}`;
}

export function formatDiagnostics(
  diagnostics: HarnessDiagnostic[],
  options: HarnessFormatOptions = {}
): string {
  if (diagnostics.length === 0) {
    return style(options, ANSI.green, "No Harness config diagnostics found.");
  }

  return diagnostics
    .map((diagnostic) => {
      const path = diagnostic.path ? ` ${diagnostic.path}` : "";
      const recommendation = diagnostic.recommendation
        ? `\n  ${diagnostic.recommendation}`
        : "";
      return `${severityPrefix(diagnostic, options)} ${diagnostic.code}${path}\n  ${diagnostic.message}${recommendation}`;
    })
    .join("\n\n");
}

function formatAction(
  root: string,
  action: HarnessInitializationAction,
  options?: HarnessFormatOptions
): string {
  const source = action.source ? toRepoRelative(root, action.source) : "";
  const target = action.target ? toRepoRelative(root, action.target) : "";
  const pathDetails =
    source && target
      ? ` (${source} -> ${target})`
      : target
        ? ` (${target})`
        : source
          ? ` (${source})`
          : "";
  return `- ${style(options, ANSI.cyan, action.kind)}: ${
    action.summary
  }${pathDetails}`;
}

export function formatInitializationPlan(
  plan: HarnessInitializationPlan,
  options: HarnessFormatOptions = {}
): string {
  const diagnostics = formatDiagnostics(plan.diagnostics, options);
  const actions =
    plan.actions.length === 0
      ? "No initialization actions needed."
      : plan.actions
          .map((action) => formatAction(plan.root, action, options))
          .join("\n");

  return `${heading(
    options,
    "Harness config initialization plan"
  )}\n\n${heading(options, "Diagnostics:")}\n${diagnostics}\n\n${heading(
    options,
    "Actions:"
  )}\n${actions}`;
}

export function formatInitializationResult(
  result: HarnessInitializationResult,
  options: HarnessFormatOptions = {}
): string {
  const actions =
    result.actions.length === 0
      ? "No initialization actions needed."
      : result.actions
          .map((action) => {
            const state = action.applied
              ? "applied"
              : action.skipped
                ? "skipped"
                : "pending";
            const reason = action.reason ? ` (${action.reason})` : "";
            return `${formatAction(result.root, action, options)}\n  ${style(
              options,
              action.applied
                ? ANSI.green
                : action.skipped
                  ? ANSI.yellow
                  : ANSI.dim,
              state
            )}${reason}`;
          })
          .join("\n");

  return `${heading(
    options,
    `Harness config initialization ${result.dryRun ? "dry run" : "result"}`
  )}\n\n${actions}`;
}
