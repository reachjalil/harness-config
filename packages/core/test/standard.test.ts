import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CURRENT_HARNESS_CONFIG_VERSION,
  createHarnessIgnoreMatcher,
  inferHarnessOverrideDirectory,
  listHarnessProjectionTargets,
  parseHarnessIgnore,
  parseHarnessConfigToml,
  resolveHarnessPaths,
  safeParseHarnessConfigToml,
  validateHarnessConfig,
} from "../src/index";

describe("HarnessConfig standard", () => {
  it("parses a valid harness.toml", () => {
    const config = parseHarnessConfigToml(`
version = 1

[standard]
name = "harness-config"

[resources.skills]
path = "./.harness/skills"

[[targets]]
path = "./.claude"
`);

    expect(config.version).toBe(CURRENT_HARNESS_CONFIG_VERSION);
    expect(config.resources.skills.path).toBe("./.harness/skills");
    expect(config.resources.rules.path).toBe("./.harness/rules");
    expect(config.targets[0]?.path).toBe("./.claude");
    expect(listHarnessProjectionTargets(config)).toEqual([
      "./.agents",
      "./.claude",
    ]);
  });

  it("infers override directories from target paths", () => {
    const config = parseHarnessConfigToml(`
version = 1

[[targets]]
path = "./.cursor"
`);

    expect(inferHarnessOverrideDirectory(config.targets[0]?.path ?? "")).toBe(
      ".cursor"
    );
    expect(inferHarnessOverrideDirectory("./.claude/skills")).toBe(".claude");
  });

  it("rejects target fields other than path", () => {
    expect(() =>
      parseHarnessConfigToml(`
version = 1

[[targets]]
path = "./.claude"
mode = "copy"
`)
    ).toThrow(/Unrecognized key/);
  });

  it("rejects resource fields other than path", () => {
    expect(() =>
      parseHarnessConfigToml(`
version = 1

[resources.skills]
path = "./.harness/skills"
entry = "SKILL.md"
`)
    ).toThrow(/Unrecognized key/);
  });

  it("rejects unknown top-level and standard fields", () => {
    expect(() =>
      parseHarnessConfigToml(`
version = 1
mode = "copy"
`)
    ).toThrow(/Unrecognized key/);

    expect(() =>
      parseHarnessConfigToml(`
version = 1

[standard]
name = "harness-config"
runtime = "agents"
`)
    ).toThrow(/Unrecognized key/);
  });

  it("returns structured safe-parse failures for invalid TOML", () => {
    const result = safeParseHarnessConfigToml(`
version = 1
[[targets]]
path = "./.claude"
path = "./.cursor"
`);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("Invalid TOML document");
    }
  });

  it("rejects target paths outside the path-only live surface shape", () => {
    for (const targetPath of [
      "/tmp/.claude",
      "../.claude",
      "./.harness/out",
      "./claude",
    ]) {
      expect(() =>
        parseHarnessConfigToml(`
version = 1

[[targets]]
path = "${targetPath}"
`)
      ).toThrow();
    }
  });

  it("reports duplicate target paths including the default .agents target", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await writeFile(
      path.join(root, ".harness/harness.toml"),
      `
version = 1

[[targets]]
path = "./.agents"

[[targets]]
path = "./.agents/skills"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.claude/"
`,
      "utf8"
    );
    await writeFile(path.join(root, ".harnessIgnore"), "", "utf8");

    const validation = await validateHarnessConfig(root);

    expect(
      validation.diagnostics
        .filter(
          (diagnostic) => diagnostic.code === "harness.target_duplicate_path"
        )
        .map((diagnostic) => diagnostic.severity)
    ).toEqual(["error", "error"]);
    expect(
      validation.diagnostics
        .filter(
          (diagnostic) => diagnostic.code === "harness.target_overlapping_path"
        )
        .map((diagnostic) => diagnostic.severity)
    ).toEqual(["error"]);
  });

  it("reports invalid TOML as a validation diagnostic", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await writeFile(
      path.join(root, ".harness/harness.toml"),
      `
version = 1
[[targets]]
path = "./.claude"
path = "./.cursor"
`,
      "utf8"
    );
    await writeFile(path.join(root, ".harnessIgnore"), "", "utf8");

    const validation = await validateHarnessConfig(root);

    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.config_invalid",
          message: expect.stringContaining("Invalid TOML document"),
        }),
      ])
    );
  });

  it("rejects unsupported schema versions", () => {
    expect(() => parseHarnessConfigToml("version = 99")).toThrow(
      /Unsupported HarnessConfig version 99/
    );
  });

  it("resolves standard paths under .harness", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    const paths = resolveHarnessPaths(root);

    expect(paths.harnessDir).toBe(path.join(root, ".harness"));
    expect(paths.ignorePath).toBe(path.join(root, ".harnessIgnore"));
    expect(paths.skillsDir).toBe(path.join(root, ".harness", "skills"));
    expect(paths.rulesDir).toBe(path.join(root, ".harness", "rules"));
    expect(paths.pluginsDir).toBe(path.join(root, ".harness", "plugins"));
  });

  it("parses .harnessIgnore patterns for projection filtering", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
# Source-only implementation metadata
.harness/reports/
.harness/**/logs/
*.tmp
!.harness/skills/review/keep.tmp
[.claude]
.harness/plugins/*/claude-only.json
[!.cursor]
.harness/plugins/*/not-cursor.json
`)
    );

    expect(matcher.ignores(".harness/reports/release.toml")).toBe(true);
    expect(matcher.ignores(".harness/skills/review/logs/run.log")).toBe(true);
    expect(
      matcher.ignores(".harness/skills/review/logs", { isDirectory: false })
    ).toBe(false);
    expect(
      matcher.ignores(".harness/skills/review/logs", { isDirectory: true })
    ).toBe(true);
    expect(matcher.ignores(".harness/skills/review/cache.tmp")).toBe(true);
    expect(matcher.ignores(".harness/skills/review/keep.tmp")).toBe(false);
    expect(matcher.ignores(".harness/skills/review/SKILL.md")).toBe(false);
    expect(
      matcher.ignores(".harness/plugins/review/claude-only.json", {
        targetPath: "./.claude",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/plugins/review/claude-only.json", {
        targetPath: "./.agents",
      })
    ).toBe(false);
    expect(
      matcher.ignores(".harness/plugins/review/not-cursor.json", {
        targetPath: "./.claude",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/plugins/review/not-cursor.json", {
        targetPath: "./.cursor",
      })
    ).toBe(false);
  });

  it("resets scoped .harnessIgnore rules with a global section", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
[.claude]
.harness/skills/*/claude-only.md

[*]
.harness/skills/*/all-targets.md
`)
    );

    expect(
      matcher.ignores(".harness/skills/review/claude-only.md", {
        targetPath: "./.claude",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/skills/review/claude-only.md", {
        targetPath: "./.agents",
      })
    ).toBe(false);
    expect(
      matcher.ignores(".harness/skills/review/all-targets.md", {
        targetPath: "./.agents",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/skills/review/all-targets.md", {
        targetPath: "./.cursor",
      })
    ).toBe(true);
  });

  it("uses last matching participating .harnessIgnore rule precedence", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
.harness/skills/review/target.md
[.claude]
!.harness/skills/review/target.md
[*]
.harness/skills/review/target.md
[.cursor]
!.harness/skills/review/target.md
`)
    );

    expect(
      matcher.ignores(".harness/skills/review/target.md", {
        targetPath: "./.agents",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/skills/review/target.md", {
        targetPath: "./.claude",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/skills/review/target.md", {
        targetPath: "./.cursor",
      })
    ).toBe(false);
  });
});
