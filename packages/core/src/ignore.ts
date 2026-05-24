import { readFile } from "node:fs/promises";

import { HARNESS_IGNORE_FILE, resolveHarnessPaths } from "./paths";
import type {
  HarnessIgnoreMatcher,
  HarnessIgnoreRule,
  HarnessIgnoreRuleKind,
} from "./types";

type SectionState = Pick<HarnessIgnoreRule, "kind" | "scope" | "target">;

export function parseHarnessIgnore(raw: string): HarnessIgnoreRule[] {
  const rules: HarnessIgnoreRule[] = [];
  const lines = raw.split(/\r?\n/);
  let state: SectionState = { kind: "ignore", scope: "all", target: undefined };

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

  return rules;
}

export function createHarnessIgnoreMatcher(
  rules: HarnessIgnoreRule[] = []
): HarnessIgnoreMatcher {
  return {
    rules,
    ignores(relativePath, options = {}) {
      return evaluate(rules, "ignore", relativePath, options);
    },
    isMutable(relativePath, options = {}) {
      return evaluate(rules, "mutable", relativePath, options);
    },
  };
}

function evaluate(
  rules: HarnessIgnoreRule[],
  kind: HarnessIgnoreRuleKind,
  relativePath: string,
  options: {
    isDirectory?: boolean;
    target?: string;
    targetPath?: string;
  }
): boolean {
  const normalized = normalizeIgnorePath(relativePath);
  if (!normalized) {
    return false;
  }

  const target = normalizeHarnessTarget(options.targetPath ?? options.target);
  let state = false;
  for (const rule of rules) {
    if (rule.kind !== kind) {
      continue;
    }
    if (!ruleAppliesToTarget(rule, target)) {
      continue;
    }
    if (matchesRule(rule, normalized, options.isDirectory === true)) {
      state = !rule.negated;
    }
  }
  return state;
}

function parseScopeSection(line: string): SectionState | undefined {
  const match = line.match(
    /^\[(?<body>(?:[a-z][a-z0-9_-]*\s+)?!?[a-z0-9_.-]+|\*|[a-z][a-z0-9_-]*)\]$/i
  );
  const body = match?.groups?.body;
  if (!body) {
    return undefined;
  }

  const tokens = body.trim().split(/\s+/);
  let kind: HarnessIgnoreRuleKind = "ignore";
  let scopeToken = tokens[0];
  if (tokens.length === 2) {
    if (tokens[0]?.toLowerCase() === "mutable") {
      kind = "mutable";
      scopeToken = tokens[1];
    } else if (tokens[0]?.toLowerCase() === "ignore") {
      kind = "ignore";
      scopeToken = tokens[1];
    } else {
      return undefined;
    }
  } else if (tokens.length === 1) {
    if (scopeToken?.toLowerCase() === "mutable") {
      return { kind: "mutable", scope: "all", target: undefined };
    }
    if (scopeToken?.toLowerCase() === "ignore") {
      return { kind: "ignore", scope: "all", target: undefined };
    }
  } else {
    return undefined;
  }

  if (!scopeToken) {
    return undefined;
  }

  if (scopeToken === "*" || scopeToken.toLowerCase() === "global") {
    return { kind, scope: "all", target: undefined };
  }

  const except = scopeToken.startsWith("!");
  const target = normalizeHarnessTarget(
    except ? scopeToken.slice(1) : scopeToken
  );
  if (!target) {
    return undefined;
  }

  return {
    kind,
    scope: except ? "except" : "only",
    target,
  };
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

function ruleAppliesToTarget(
  rule: HarnessIgnoreRule,
  target: string | undefined
): boolean {
  if (rule.scope === "all") {
    return true;
  }
  if (rule.scope === "only") {
    return target === rule.target;
  }
  return target !== rule.target;
}

export async function loadHarnessIgnoreMatcher(
  root = process.cwd()
): Promise<HarnessIgnoreMatcher> {
  const ignorePath = resolveHarnessPaths(root).ignorePath;
  const raw = await readFile(ignorePath, "utf8").catch((error: unknown) => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "";
    }
    throw error;
  });
  return createHarnessIgnoreMatcher(parseHarnessIgnore(raw));
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
    "# Use [.claude] to scope following rules to one target, or [!.cursor] to apply to all except one target.",
    "# Use [mutable] to mark files the runtime owns after first projection (e.g. .harness/**/settings.local.json).",
    "# Use [mutable .claude] or [mutable !.cursor] to scope mutable rules to specific targets.",
    "# Example: .harness/**/logs/",
    "",
  ].join("\n");
}

export { HARNESS_IGNORE_FILE };
