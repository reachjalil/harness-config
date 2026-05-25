import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CURRENT_HARNESS_CONFIG_VERSION,
  createHarnessIgnoreMatcher,
  detectImplicitOverrideTarget,
  inferHarnessOverrideDirectory,
  loadHarnessProfileContext,
  listHarnessProjectionTargets,
  loadHarnessIgnoreRuleSets,
  parseHarnessIgnore,
  parseHarnessIgnoreFile,
  parseHarnessConfigToml,
  resolveHarnessPaths,
  safeParseHarnessConfigToml,
  validateHarnessConfig,
} from "../src/index";

async function write(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

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
    expect(config.resources.rules).toBeUndefined();
    expect(config.targets[0]?.path).toBe("./.claude");
    expect(config.extensions).toEqual({});
    expect(listHarnessProjectionTargets(config)).toEqual(["./.claude"]);
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

  it("does not invent targets or resource roots that are not declared", () => {
    const config = parseHarnessConfigToml("version = 1");

    expect(config.resources).toEqual({});
    expect(listHarnessProjectionTargets(config)).toEqual([]);
    expect(config.extensions).toEqual({});
  });

  it("parses extension declarations with core-owned defaults and extension-owned fields", () => {
    const config = parseHarnessConfigToml(`
version = 1

[extensions.dir]
version = 1
path = "./.harness/dir"
`);

    expect(config.extensions.dir).toEqual({
      version: 1,
      activation: "explicit",
      path: "./.harness/dir",
    });
  });

  it("parses extension activation policy", () => {
    const config = parseHarnessConfigToml(`
version = 1

[extensions.dir]
version = 1
activation = "auto"
path = "./.harness/dir"
`);

    expect(config.extensions.dir?.activation).toBe("auto");
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

  it("rejects invalid extension ids and core extension fields", () => {
    expect(() =>
      parseHarnessConfigToml(`
version = 1

[extensions.Bad]
version = 1
`)
    ).toThrow(/Invalid extension id/);

    expect(() =>
      parseHarnessConfigToml(`
version = 1

[extensions.dir]
activation = "explicit"
`)
    ).toThrow();

    expect(() =>
      parseHarnessConfigToml(`
version = 1

[extensions.dir]
version = 1
activation = "sometimes"
`)
    ).toThrow();
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

  it("allows explicit .agents targets and reports declared duplicates", async () => {
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
    ).toEqual(["error"]);
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

  it("reports invalid profile root declarations during validation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(root, ".harness/harness.toml", "version = 1\n");
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/profiles/bad/.harnessProfileRoot", "\n");

    const validation = await validateHarnessConfig(root);

    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.profile_empty",
          path: ".harness/profiles/bad/.harnessProfileRoot",
        }),
      ])
    );
  });

  it("rejects unsupported schema versions", () => {
    expect(() => parseHarnessConfigToml("version = 99")).toThrow(
      /Unsupported HarnessConfig version 99/
    );
  });

  it("resolves canonical and conventional paths under .harness", async () => {
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
.harness/plugins/*/source-only.json
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
    expect(matcher.ignores(".harness/plugins/review/source-only.json")).toBe(
      true
    );
  });

  it("resets mutable .harnessIgnore rules with an ignore section", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
[mutable]
.harness/skills/*/settings.local.json

[ignore]
.harness/skills/*/all-targets.md
`)
    );

    expect(
      matcher.isMutable(".harness/skills/review/settings.local.json")
    ).toBe(true);
    expect(matcher.ignores(".harness/skills/review/settings.local.json")).toBe(
      false
    );
    expect(matcher.ignores(".harness/skills/review/all-targets.md")).toBe(true);
    expect(matcher.isMutable(".harness/skills/review/all-targets.md")).toBe(
      false
    );
  });

  it("uses last matching .harnessIgnore rule precedence", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
.harness/skills/review/target.md
!.harness/skills/review/target.md
.harness/skills/review/target.md
!.harness/skills/review/target.md
`)
    );

    expect(matcher.ignores(".harness/skills/review/target.md")).toBe(false);
  });

  it("parses [mutable] scopes and switches back to ignore scopes", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
[mutable]
.harness/**/settings.local.json

[ignore]
.harness/skills/*/ignored-elsewhere.md
`)
    );

    expect(matcher.isMutable(".harness/skills/x/settings.local.json")).toBe(
      true
    );
    // Ignore section after mutable scope returns kind to ignore.
    expect(matcher.ignores(".harness/skills/x/ignored-elsewhere.md")).toBe(
      true
    );
    expect(matcher.isMutable(".harness/skills/x/ignored-elsewhere.md")).toBe(
      false
    );
  });

  it("treats nested .harnessIgnore patterns as relative to the file's directory", () => {
    const nested = parseHarnessIgnoreFile("*.tmp", {
      isRoot: false,
      sourcePath: ".harness/skills/review/.harnessIgnore",
    });
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: nested.rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/skills/review/scratch.tmp")).toBe(true);
    expect(matcher.ignores(".harness/skills/review/nested/scratch.tmp")).toBe(
      true
    );
    expect(matcher.ignores(".harness/skills/triage/scratch.tmp")).toBe(false);
  });

  it("lets a nested rule re-include a path the root file ignored", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(".harness/skills/review/*.tmp"),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
      },
      {
        rules: parseHarnessIgnoreFile("!keep.tmp", {
          isRoot: false,
          sourcePath: ".harness/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/skills/review/drop.tmp")).toBe(true);
    expect(matcher.ignores(".harness/skills/review/keep.tmp")).toBe(false);
  });

  it("lets a deeper nested rule override a shallower nested rule", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(".harness/skills/**/draft.md"),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
      },
      {
        rules: parseHarnessIgnoreFile("!review/draft.md", {
          isRoot: false,
          sourcePath: ".harness/skills/.harnessIgnore",
        }).rules,
        directory: ".harness/skills",
        sourcePath: ".harness/skills/.harnessIgnore",
        isRoot: false,
      },
      {
        rules: parseHarnessIgnoreFile("draft.md", {
          isRoot: false,
          sourcePath: ".harness/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/skills/review/draft.md")).toBe(true);
    expect(matcher.ignores(".harness/skills/triage/draft.md")).toBe(true);
  });

  it("evaluates rule sets shallow-first and applies last-match precedence across files", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(".harness/skills/review/*.md"),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
      },
      {
        rules: parseHarnessIgnoreFile("!README.md", {
          isRoot: false,
          sourcePath: ".harness/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ruleSets.map((ruleSet) => ruleSet.directory)).toEqual([
      "",
      ".harness/skills/review",
    ]);
    expect(matcher.ignores(".harness/skills/review/NOTE.md")).toBe(true);
    expect(matcher.ignores(".harness/skills/review/README.md")).toBe(false);
  });

  it("matches target-based rule sets against output paths", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile("*.tmp", {
          isRoot: false,
          sourcePath: ".agents/skills/review/.harnessIgnore",
        }).rules,
        directory: ".agents/skills/review",
        sourcePath: ".agents/skills/review/.harnessIgnore",
        isRoot: false,
        matchBase: "target",
      },
    ]);

    expect(
      matcher.ignores(".harness/skills/review/scratch.tmp", {
        outputPath: ".agents/skills/review/scratch.tmp",
      })
    ).toBe(true);
    expect(matcher.ignores(".harness/skills/review/scratch.tmp")).toBe(false);
  });

  it("lets root rule sets match source and target output paths", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(".agents/**/local.md\n.harness/**/logs/"),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
        matchBase: "both",
      },
    ]);

    expect(
      matcher.ignores(".harness/skills/review/logs/run.log", {
        outputPath: ".agents/skills/review/logs/run.log",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/skills/review/local.md", {
        outputPath: ".agents/skills/review/local.md",
      })
    ).toBe(true);
  });

  it("preserves root rule order when source and output path rules both match", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(
          ".agents/**/target.md\n!.harness/skills/review/target.md"
        ),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
        matchBase: "both",
      },
    ]);

    expect(
      matcher.ignores(".harness/skills/review/target.md", {
        outputPath: ".agents/skills/review/target.md",
      })
    ).toBe(false);
  });

  it("lets deeper target-based rule sets override shallower target rules", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile("*.md", {
          isRoot: false,
          sourcePath: ".agents/skills/.harnessIgnore",
        }).rules,
        directory: ".agents/skills",
        sourcePath: ".agents/skills/.harnessIgnore",
        isRoot: false,
        matchBase: "target",
      },
      {
        rules: parseHarnessIgnoreFile("!README.md", {
          isRoot: false,
          sourcePath: ".agents/skills/review/.harnessIgnore",
        }).rules,
        directory: ".agents/skills/review",
        sourcePath: ".agents/skills/review/.harnessIgnore",
        isRoot: false,
        matchBase: "target",
      },
    ]);

    expect(
      matcher.ignores(".harness/skills/review/NOTE.md", {
        outputPath: ".agents/skills/review/NOTE.md",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/skills/review/README.md", {
        outputPath: ".agents/skills/review/README.md",
      })
    ).toBe(false);
  });

  it("supports [mutable] sections in nested files", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile(
          `
[mutable]
settings.local.json
`,
          {
            isRoot: false,
            sourcePath: ".harness/skills/review/.harnessIgnore",
          }
        ).rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(
      matcher.isMutable(".harness/skills/review/settings.local.json")
    ).toBe(true);
    expect(
      matcher.isMutable(".harness/skills/triage/settings.local.json")
    ).toBe(false);
  });

  it("rejects target-scoped sections and ignores rules below them until a supported section", async () => {
    const parsed = parseHarnessIgnoreFile(
      `
[.claude]
secret.md

[global]
shared.md

[mutable .cursor]
state.json
`,
      {
        isRoot: false,
        sourcePath: ".harness/skills/review/.harnessIgnore",
      }
    );
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parsed.rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(parsed.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        message: expect.stringContaining("[.claude]"),
      }),
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        message: expect.stringContaining("[mutable .cursor]"),
      }),
    ]);
    expect(matcher.ignores(".harness/skills/review/secret.md")).toBe(false);
    expect(matcher.ignores(".harness/skills/review/shared.md")).toBe(true);
    expect(matcher.isMutable(".harness/skills/review/state.json")).toBe(false);

    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/skills/review/.harnessIgnore",
      "[.claude]\nsecret.md\n"
    );
    await expect(loadHarnessIgnoreRuleSets(root)).resolves.toMatchObject({
      diagnostics: [
        expect.objectContaining({
          code: "harness.ignore_unsupported_scope",
        }),
      ],
    });
  });

  it("emits unsupported-scope diagnostics for [.claude] inside a .claude override", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/skills/review/.claude/.harnessIgnore",
      "[.claude]\nsecret.md\n"
    );

    const { ruleSets, diagnostics } = await loadHarnessIgnoreRuleSets(root);

    expect(
      ruleSets.find(
        (ruleSet) =>
          ruleSet.sourcePath === ".harness/skills/review/.claude/.harnessIgnore"
      )?.rules
    ).toEqual([]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        path: ".harness/skills/review/.claude/.harnessIgnore",
      }),
    ]);
  });

  it("emits unsupported-scope diagnostics for [!.cursor] inside a .claude override", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/skills/review/.claude/.harnessIgnore",
      "[!.cursor]\nshared.md\n"
    );

    const { diagnostics } = await loadHarnessIgnoreRuleSets(root);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        message: expect.stringContaining("[!.cursor]"),
      }),
    ]);
  });

  it("emits unsupported-scope diagnostics for [.cursor] inside a .claude override", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/skills/review/.claude/.harnessIgnore",
      "[.cursor]\ndead.md\n"
    );

    const { diagnostics } = await loadHarnessIgnoreRuleSets(root);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        message: expect.stringContaining("[.cursor]"),
      }),
    ]);
  });

  it("emits unsupported-scope diagnostics for [!.claude] inside a .claude override", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/skills/review/.claude/.harnessIgnore",
      "[!.claude]\ndead.md\n"
    );

    const { diagnostics } = await loadHarnessIgnoreRuleSets(root);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        message: expect.stringContaining("[!.claude]"),
      }),
    ]);
  });

  it("emits no diagnostic for [mutable] or [*] inside an override", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/skills/review/.claude/.harnessIgnore",
      "[*]\nshared.md\n\n[mutable]\nsettings.local.json\n"
    );

    const { diagnostics } = await loadHarnessIgnoreRuleSets(root);

    expect(diagnostics).toEqual([]);
  });

  it("applies nested rules by directory locality", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile("secret.md\n", {
          isRoot: false,
          sourcePath: ".harness/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/skills/review/secret.md")).toBe(true);
    expect(matcher.ignores(".harness/skills/other/secret.md")).toBe(false);
  });

  it("detects implicit override target via detectImplicitOverrideTarget()", () => {
    expect(
      detectImplicitOverrideTarget(
        ".harness/skills/review/.claude/.harnessIgnore"
      )
    ).toBe(".claude");
    expect(
      detectImplicitOverrideTarget(
        ".harness/skills/review/.claude/nested/.harnessIgnore"
      )
    ).toBe(".claude");
    expect(
      detectImplicitOverrideTarget(
        ".harness/skills/review/nested/.claude/.harnessIgnore"
      )
    ).toBeUndefined();
    expect(
      detectImplicitOverrideTarget(".harness/skills/review/.harnessIgnore")
    ).toBeUndefined();
  });

  it("scopes nested rules to the file's subtree (siblings unaffected)", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile("*.tmp", {
          isRoot: false,
          sourcePath: ".harness/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/skills/review",
        sourcePath: ".harness/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/skills/review/cache.tmp")).toBe(true);
    expect(matcher.ignores(".harness/skills/triage/cache.tmp")).toBe(false);
  });

  it("ignores .harnessIgnore files themselves from projection by default", () => {
    const matcher = createHarnessIgnoreMatcher();

    expect(matcher.rules[0]).toEqual(
      expect.objectContaining({
        kind: "ignore",
        pattern: "**/.harnessIgnore",
      })
    );
    expect(matcher.ignores(".harness/skills/review/.harnessIgnore")).toBe(true);
    expect(matcher.ignores(".harness/skills/review/.harnessProfile")).toBe(
      true
    );
    expect(matcher.ignores(".harness/skills/deploy/.harnessProfileRoot")).toBe(
      true
    );
  });

  it("discovers root and target-local profile selectors", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(root, ".harnessProfile", "deploy\n");
    await write(root, ".agents/skills/.harnessProfile", "skills-only\n");
    await write(
      root,
      ".harness/profiles/deploy/.harnessProfileRoot",
      "deploy\n"
    );

    const context = await loadHarnessProfileContext(root, {
      targetRoots: [path.join(root, ".agents")],
    });

    expect(context.diagnostics).toEqual([]);
    expect(context.profileForOutput(".agents/rules/check/SKILL.md")).toBe(
      "deploy"
    );
    expect(context.profileForOutput(".agents/skills/review/SKILL.md")).toBe(
      "skills-only"
    );
    expect(context.profileRoots).toEqual([
      expect.objectContaining({
        profile: "deploy",
        overlayBase: path.join(root, ".harness"),
      }),
    ]);
    expect(context.protectedTargetPaths).toEqual([
      ".agents/skills/.harnessProfile",
    ]);
  });

  it("treats ignore and mutable evaluations as independent", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
[mutable]
.harness/**/settings.local.json

[*]
.harness/**/*.log
`)
    );

    expect(matcher.ignores(".harness/skills/x/run.log")).toBe(true);
    expect(matcher.isMutable(".harness/skills/x/run.log")).toBe(false);
    expect(matcher.ignores(".harness/skills/x/settings.local.json")).toBe(
      false
    );
    expect(matcher.isMutable(".harness/skills/x/settings.local.json")).toBe(
      true
    );
  });
});
