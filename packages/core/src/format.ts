import { toRepoRelative } from "./paths";
import type {
  HarnessActivationAction,
  HarnessActivationPlan,
  HarnessActivationResult,
  HarnessDiagnostic,
  HarnessTransitionAction,
  HarnessTransitionPlan,
  HarnessTransitionResult,
} from "./types";

function severityPrefix(diagnostic: HarnessDiagnostic): string {
  return diagnostic.severity.toUpperCase();
}

function formatActivationAction(
  root: string,
  action: HarnessActivationAction
): string {
  const target = toRepoRelative(root, action.targetPath);
  const source = action.sourcePath
    ? toRepoRelative(root, action.sourcePath)
    : "";
  const sourceDetails = source ? ` <- ${source}` : "";
  const reason = action.reason ? ` (${action.reason})` : "";
  return `${action.kind}: ${target}${sourceDetails}${reason}`;
}

export function formatActivationPlan(plan: HarnessActivationPlan): string {
  const diagnostics = formatDiagnostics(plan.diagnostics);
  const targets =
    plan.targets.length === 0
      ? "No activation targets."
      : plan.targets
          .map((target) => {
            const summary = summarizeActivationActions(target.actions);
            const policy = target.actions.some(
              (action) => action.kind === "preserve"
            )
              ? "\nUnmanaged policy: keeping existing target entries that are not in .harness. Use --remove-unmanaged to delete them."
              : "";
            const actions =
              target.actions.length === 0
                ? "  No file changes."
                : formatActivationActionSections(plan.root, target.actions);
            return `${target.path} (${target.strategy}, override ${target.override})\nSummary: ${summary}${policy}\n${actions}`;
          })
          .join("\n\n");

  return `HarnessConfig activation plan\n\nIdempotency:\nRunning activation with the same .harness tree, harness.toml, and .harnessIgnore produces the same projections.\n\nDiagnostics:\n${diagnostics}\n\nTargets:\n${targets}`;
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
  };
  for (const action of actions) {
    counts[action.kind] += 1;
  }

  return [
    `create ${counts.create}`,
    `update ${counts.update}`,
    `remove ${counts.remove}`,
    `keep ${counts.keep}`,
    `preserve unmanaged ${counts.preserve}`,
  ].join(", ");
}

function formatActivationActionSections(
  root: string,
  actions: HarnessActivationAction[]
): string {
  const sections: Array<{
    title: string;
    kinds: HarnessActivationAction["kind"][];
    limit: number;
  }> = [
    { title: "Creates", kinds: ["create"], limit: 12 },
    { title: "Updates", kinds: ["update"], limit: 12 },
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
        (action) => `  - ${formatActivationAction(root, action)}`
      );
      const remaining = sectionActions.length - visibleActions.length;
      if (remaining > 0) {
        lines.push(`  - ... ${remaining} more`);
      }
      return `${section.title}\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function formatActivationResult(
  result: HarnessActivationResult
): string {
  const applied =
    result.appliedActions.length === 0
      ? "No file changes applied."
      : result.appliedActions
          .map((action) => formatActivationAction(result.root, action))
          .join("\n");

  return `HarnessConfig activation ${result.dryRun ? "dry run" : "result"}\n\n${formatActivationPlan(result.plan)}\n\nApplied:\n${applied}`;
}

export function formatDiagnostics(diagnostics: HarnessDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "No HarnessConfig diagnostics found.";
  }

  return diagnostics
    .map((diagnostic) => {
      const path = diagnostic.path ? ` ${diagnostic.path}` : "";
      const recommendation = diagnostic.recommendation
        ? `\n  ${diagnostic.recommendation}`
        : "";
      return `${severityPrefix(diagnostic)} ${diagnostic.code}${path}\n  ${
        diagnostic.message
      }${recommendation}`;
    })
    .join("\n\n");
}

function formatAction(root: string, action: HarnessTransitionAction): string {
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
  return `- ${action.kind}: ${action.summary}${pathDetails}`;
}

export function formatTransitionPlan(plan: HarnessTransitionPlan): string {
  const diagnostics = formatDiagnostics(plan.diagnostics);
  const actions =
    plan.actions.length === 0
      ? "No transition actions needed."
      : plan.actions
          .map((action) => formatAction(plan.root, action))
          .join("\n");

  return `HarnessConfig transition plan\n\nDiagnostics:\n${diagnostics}\n\nActions:\n${actions}`;
}

export function formatTransitionResult(
  result: HarnessTransitionResult
): string {
  const actions =
    result.actions.length === 0
      ? "No transition actions needed."
      : result.actions
          .map((action) => {
            const state = action.applied
              ? "applied"
              : action.skipped
                ? "skipped"
                : "pending";
            const reason = action.reason ? ` (${action.reason})` : "";
            return `${formatAction(result.root, action)}\n  ${state}${reason}`;
          })
          .join("\n");

  return `HarnessConfig transition ${result.dryRun ? "dry run" : "result"}\n\n${actions}`;
}
