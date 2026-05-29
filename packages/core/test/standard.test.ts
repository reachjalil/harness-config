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
  parseHarnessMutable,
  parseHarnessMutableFile,
  parseHarnessConfigToml,
  resolveHarnessPaths,
  safeParseHarnessConfigToml,
  stringifyHarnessConfig,
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

[[targets]]
path = "./.claude"
`);

    expect(config.version).toBe(CURRENT_HARNESS_CONFIG_VERSION);
    expect(config.targets[0]?.path).toBe("./.claude");
    expect(config.activation.targetSymlinks).toBe("conflict");
    expect(config.extensions).toEqual({});
    expect(listHarnessProjectionTargets(config)).toEqual(["./.claude"]);
  });

  it("parses activation target symlink policy", () => {
    const config = parseHarnessConfigToml(`
version = 1

[activation]
targetSymlinks = "replace"
`);

    expect(config.activation.targetSymlinks).toBe("replace");
    expect(stringifyHarnessConfig(config)).toContain("[activation]");
    expect(
      stringifyHarnessConfig(parseHarnessConfigToml("version = 1"))
    ).not.toContain("[activation]");
  });

  it("parses ordered configurable resources source roots", () => {
    const config = parseHarnessConfigToml(`
version = 1

[[resources]]
path = "./agent-context/resources"

[[resources]]
path = "./agent-context/local/resources"

[[targets]]
path = "./.agents"
`);

    expect(config.resources.map((source) => source.path)).toEqual([
      "./agent-context/resources",
      "./agent-context/local/resources",
    ]);
    expect(stringifyHarnessConfig(config)).toContain("[[resources]]");
    expect(
      stringifyHarnessConfig(parseHarnessConfigToml("version = 1"))
    ).not.toContain("[resources]");
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

  it("does not invent targets that are not declared", () => {
    const config = parseHarnessConfigToml("version = 1");

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

  it("rejects legacy single-table and per-kind manifest resource declarations", () => {
    expect(() =>
      parseHarnessConfigToml(`
version = 1

[resources]
path = "./agent-context/resources"
`)
    ).toThrow(/expected array/);

    expect(() =>
      parseHarnessConfigToml(`
version = 1

[resources.skills]
path = "./.harness/resources/skills"
`)
    ).toThrow(/expected array/);

    expect(() =>
      parseHarnessConfigToml(`
version = 1

[dir]
path = "./.harness/dir"
`)
    ).toThrow(/expected array/);
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

  it("allows repo-local target names without runtime naming opinions", () => {
    const config = parseHarnessConfigToml(`
version = 1

[[targets]]
path = "./runtime/agent"

[[targets]]
path = "./.claude"
`);

    expect(listHarnessProjectionTargets(config)).toEqual([
      "./runtime/agent",
      "./.claude",
    ]);
    expect(inferHarnessOverrideDirectory("./runtime/agent")).toBe(".runtime");
  });

  it("rejects target paths outside the repo or under .harness", () => {
    for (const targetPath of [
      "/tmp/.claude",
      "../.claude",
      "./.harness/out",
      ".",
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

  it("rejects source paths that point at the repository root", () => {
    expect(() =>
      parseHarnessConfigToml(`
version = 1

[[resources]]
path = "."
`)
    ).toThrow(/Source paths must point at a repo-local folder/);

    expect(() =>
      parseHarnessConfigToml(`
version = 1

[[dir]]
path = "./"
`)
    ).toThrow(/Source paths must point at a repo-local folder/);
  });

  it("allows explicit .agents targets and reports declared duplicates", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await writeFile(
      path.join(root, ".harness", "harness.toml"),
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

  it("reports duplicate target paths after separator normalization", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      `
version = 1

[[targets]]
path = "./.agents/skills"

[[targets]]
path = "./.agents//skills"
`
    );
    await write(root, ".harnessIgnore", "");

    const validation = await validateHarnessConfig(root);

    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.target_duplicate_path",
        }),
      ])
    );
  });

  it("reports invalid TOML as a validation diagnostic", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await writeFile(
      path.join(root, ".harness", "harness.toml"),
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

  it("reports nested profile roots during validation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(root, ".harness/harness.toml", "version = 1\n");
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/profiles/team/.harnessProfileRoot", "team\n");
    await write(
      root,
      ".harness/profiles/team/nested/.harnessProfileRoot",
      "team\n"
    );

    const inspection = await validateHarnessConfig(root);

    expect(inspection.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.profile_nested_root",
          path: ".harness/profiles/team/nested/.harnessProfileRoot",
        }),
      ])
    );
  });

  it("reports profile roots outside configured source roots during validation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      'version = 1\n\n[[targets]]\npath = "./.agents"\n'
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".agents/skills/review/.harnessProfileRoot", "team\n");

    const inspection = await validateHarnessConfig(root);

    expect(inspection.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.profile_root_outside_source_roots",
          path: ".agents/skills/review/.harnessProfileRoot",
        }),
      ])
    );
  });

  it("allows profile roots under a configured resources root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[[resources]]",
        'path = "./agent-context/resources"',
        "",
        "[[targets]]",
        'path = "./.agents"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      "agent-context/resources/team/.harnessProfileRoot",
      "team\n"
    );

    const inspection = await validateHarnessConfig(root);

    expect(
      inspection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "harness.profile_root_outside_source_roots"
      )
    ).toBe(false);
  });

  it("reports configured source roots that overlap each other or targets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[[resources]]",
        'path = "./agent-context"',
        "",
        "[[dir]]",
        'path = "./agent-context/dir"',
        "",
        "[[targets]]",
        'path = "./agent-context/out"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");

    const inspection = await validateHarnessConfig(root);
    const codes = inspection.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain("harness.source_path_overlapping");
    expect(codes).toContain("harness.target_overlaps_source_path");
  });

  it("allows missing configured source roots as empty layers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[[resources]]",
        'path = "./.harness/resources"',
        "",
        "[[resources]]",
        'path = "./.harness/local/resources"',
        "",
        "[[dir]]",
        'path = "./.harness/dir"',
        "",
        "[[dir]]",
        'path = "./.harness/local/dir"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");

    const inspection = await validateHarnessConfig(root);

    expect(inspection.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error" }),
        expect.objectContaining({ code: "harness.dir_root_missing" }),
      ])
    );
  });

  it("reports dir planning diagnostics during validation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      ["version = 1", "", "[[dir]]", 'path = "./.harness/dir"', ""].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/intro.md", "invalid");

    const validation = await validateHarnessConfig(root);

    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.dir_invalid_part",
          path: ".harness/dir/AGENTS.md/intro.md",
        }),
      ])
    );
  });

  it("rejects unsupported schema versions", () => {
    expect(() => parseHarnessConfigToml("version = 99")).toThrow(
      /Unsupported Harness config version 99/
    );
  });

  it("resolves canonical and conventional paths under .harness", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    const paths = resolveHarnessPaths(root);

    expect(paths.harnessDir).toBe(path.join(root, ".harness"));
    expect(paths.configPath).toBe(path.join(root, ".harness", "harness.toml"));
    expect(paths.ignorePath).toBe(path.join(root, ".harnessIgnore"));
    expect(paths.resourcesDir).toBe(path.join(root, ".harness", "resources"));
    expect(paths.skillsDir).toBe(
      path.join(root, ".harness", "resources", "skills")
    );
    expect(paths.rulesDir).toBe(
      path.join(root, ".harness", "resources", "rules")
    );
    expect(paths.pluginsDir).toBe(
      path.join(root, ".harness", "resources", "plugins")
    );
  });

  it("resolves repo-local custom config and resources paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    const paths = resolveHarnessPaths(root, {
      configPath: "./config/harness.local.toml",
      config: { resources: [{ path: "./agent-context/catalog" }] },
    });

    expect(paths.configPath).toBe(
      path.join(root, "config", "harness.local.toml")
    );
    expect(paths.resourcesDir).toBe(
      path.join(root, "agent-context", "catalog")
    );
    expect(paths.skillsDir).toBe(
      path.join(root, "agent-context", "catalog", "skills")
    );
  });

  it("reports configured source paths that overlap targets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[[resources]]",
        'path = "./agent-context"',
        "",
        "[[targets]]",
        'path = "./agent-context/.agents"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");

    const validation = await validateHarnessConfig(root);

    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.target_overlaps_source_path",
          path: 'targets["./agent-context/.agents"].path',
        }),
      ])
    );
  });

  it("parses .harnessIgnore patterns for projection filtering", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
# Source-only implementation metadata
.harness/reports/
.harness/**/logs/
*.tmp
!.harness/resources/skills/review/keep.tmp
.harness/resources/plugins/*/source-only.json
`)
    );

    expect(matcher.ignores(".harness/reports/release.toml")).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/logs/run.log")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/logs", {
        isDirectory: false,
      })
    ).toBe(false);
    expect(
      matcher.ignores(".harness/resources/skills/review/logs", {
        isDirectory: true,
      })
    ).toBe(true);
    expect(matcher.ignores(".harness/resources/skills/review/cache.tmp")).toBe(
      true
    );
    expect(matcher.ignores(".harness/resources/skills/review/keep.tmp")).toBe(
      false
    );
    expect(matcher.ignores(".harness/resources/skills/review/SKILL.md")).toBe(
      false
    );
    expect(
      matcher.ignores(".harness/resources/plugins/review/source-only.json")
    ).toBe(true);
  });

  it("keeps mutable declarations separate from .harnessIgnore rules", () => {
    const matcher = createHarnessIgnoreMatcher([
      ...parseHarnessMutable(`
.harness/resources/skills/*/settings.local.json
`),
      ...parseHarnessIgnore(`
.harness/resources/skills/*/all-targets.md
`),
    ]);

    expect(
      matcher.isMutable(".harness/resources/skills/review/settings.local.json")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/settings.local.json")
    ).toBe(false);
    expect(
      matcher.ignores(".harness/resources/skills/review/all-targets.md")
    ).toBe(true);
    expect(
      matcher.isMutable(".harness/resources/skills/review/all-targets.md")
    ).toBe(false);
  });

  it("uses last matching .harnessIgnore rule precedence", () => {
    const matcher = createHarnessIgnoreMatcher(
      parseHarnessIgnore(`
.harness/resources/skills/review/target.md
!.harness/resources/skills/review/target.md
.harness/resources/skills/review/target.md
!.harness/resources/skills/review/target.md
`)
    );

    expect(matcher.ignores(".harness/resources/skills/review/target.md")).toBe(
      false
    );
  });

  it("parses .harnessMutable patterns as mutable rules", () => {
    const matcher = createHarnessIgnoreMatcher([
      ...parseHarnessMutable(`
[mutable]
.harness/**/settings.local.json
`),
      ...parseHarnessIgnore(`
.harness/resources/skills/*/ignored-elsewhere.md
`),
    ]);

    expect(
      matcher.isMutable(".harness/resources/skills/x/settings.local.json")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/x/ignored-elsewhere.md")
    ).toBe(true);
    expect(
      matcher.isMutable(".harness/resources/skills/x/ignored-elsewhere.md")
    ).toBe(false);
  });

  it("rejects [mutable] in .harnessIgnore and ignores rules below it", () => {
    const parsed = parseHarnessIgnoreFile(
      `
[mutable]
.harness/**/settings.local.json
`,
      {
        isRoot: true,
        sourcePath: ".harnessIgnore",
      }
    );
    const matcher = createHarnessIgnoreMatcher(parsed.rules);

    expect(parsed.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_mutable_section_unsupported",
        path: ".harnessIgnore",
      }),
    ]);
    expect(
      matcher.isMutable(".harness/resources/skills/x/settings.local.json")
    ).toBe(false);
    expect(
      matcher.ignores(".harness/resources/skills/x/settings.local.json")
    ).toBe(false);
  });

  it("rejects [ignore] in .harnessMutable and ignores rules below it", () => {
    const parsed = parseHarnessMutableFile(
      `
[ignore]
.harness/**/settings.local.json
`,
      {
        isRoot: true,
        sourcePath: ".harnessMutable",
      }
    );
    const matcher = createHarnessIgnoreMatcher(parsed.rules);

    expect(parsed.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.mutable_ignore_section_unsupported",
        path: ".harnessMutable",
      }),
    ]);
    expect(
      matcher.isMutable(".harness/resources/skills/x/settings.local.json")
    ).toBe(false);
    expect(
      matcher.ignores(".harness/resources/skills/x/settings.local.json")
    ).toBe(false);
  });

  it("treats nested .harnessIgnore patterns as relative to the file's directory", () => {
    const nested = parseHarnessIgnoreFile("*.tmp", {
      isRoot: false,
      sourcePath: ".harness/resources/skills/review/.harnessIgnore",
    });
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: nested.rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(
      matcher.ignores(".harness/resources/skills/review/scratch.tmp")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/nested/scratch.tmp")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/triage/scratch.tmp")
    ).toBe(false);
  });

  it("lets a nested rule re-include a path the root file ignored", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(".harness/resources/skills/review/*.tmp"),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
      },
      {
        rules: parseHarnessIgnoreFile("!keep.tmp", {
          isRoot: false,
          sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/resources/skills/review/drop.tmp")).toBe(
      true
    );
    expect(matcher.ignores(".harness/resources/skills/review/keep.tmp")).toBe(
      false
    );
  });

  it("keeps negated directory-only patterns from re-including every descendant", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(
          ".harness/resources/skills/**\n!.harness/resources/skills/\n!.harness/resources/skills/selected/**\n"
        ),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
      },
    ]);

    expect(matcher.ignores(".harness/resources/skills/other/SKILL.md")).toBe(
      true
    );
    expect(matcher.ignores(".harness/resources/skills/selected/SKILL.md")).toBe(
      false
    );
  });

  it("lets a deeper nested rule override a shallower nested rule", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(".harness/resources/skills/**/draft.md"),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
      },
      {
        rules: parseHarnessIgnoreFile("!review/draft.md", {
          isRoot: false,
          sourcePath: ".harness/resources/skills/.harnessIgnore",
        }).rules,
        directory: ".harness/resources/skills",
        sourcePath: ".harness/resources/skills/.harnessIgnore",
        isRoot: false,
      },
      {
        rules: parseHarnessIgnoreFile("draft.md", {
          isRoot: false,
          sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/resources/skills/review/draft.md")).toBe(
      true
    );
    expect(matcher.ignores(".harness/resources/skills/triage/draft.md")).toBe(
      true
    );
  });

  it("evaluates rule sets shallow-first and applies last-match precedence across files", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(".harness/resources/skills/review/*.md"),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
      },
      {
        rules: parseHarnessIgnoreFile("!README.md", {
          isRoot: false,
          sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ruleSets.map((ruleSet) => ruleSet.directory)).toEqual([
      "",
      ".harness/resources/skills/review",
    ]);
    expect(matcher.ignores(".harness/resources/skills/review/NOTE.md")).toBe(
      true
    );
    expect(matcher.ignores(".harness/resources/skills/review/README.md")).toBe(
      false
    );
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
      matcher.ignores(".harness/resources/skills/review/scratch.tmp", {
        outputPath: ".agents/skills/review/scratch.tmp",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/scratch.tmp")
    ).toBe(false);
  });

  it("applies target-scoped ignore rule objects by target", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: [
          {
            kind: "ignore",
            pattern: "claude.md",
            negated: false,
            directoryOnly: false,
            anchored: false,
            sourceLine: 2,
            scope: "only",
            target: ".claude",
          },
          {
            kind: "ignore",
            pattern: "not-claude.md",
            negated: false,
            directoryOnly: false,
            anchored: false,
            sourceLine: 3,
            scope: "except",
            target: ".claude",
          },
        ],
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(
      matcher.ignores(".harness/resources/skills/review/claude.md", {
        targetPath: ".claude",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/claude.md", {
        targetPath: ".agents",
      })
    ).toBe(false);
    expect(
      matcher.ignores(".harness/resources/skills/review/not-claude.md", {
        targetPath: ".agents",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/not-claude.md", {
        targetPath: ".claude",
      })
    ).toBe(false);
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
      matcher.ignores(".harness/resources/skills/review/logs/run.log", {
        outputPath: ".agents/skills/review/logs/run.log",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/local.md", {
        outputPath: ".agents/skills/review/local.md",
      })
    ).toBe(true);
  });

  it("preserves root rule order when source and output path rules both match", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnore(
          ".agents/**/target.md\n!.harness/resources/skills/review/target.md"
        ),
        directory: "",
        sourcePath: ".harnessIgnore",
        isRoot: true,
        matchBase: "both",
      },
    ]);

    expect(
      matcher.ignores(".harness/resources/skills/review/target.md", {
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
      matcher.ignores(".harness/resources/skills/review/NOTE.md", {
        outputPath: ".agents/skills/review/NOTE.md",
      })
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/README.md", {
        outputPath: ".agents/skills/review/README.md",
      })
    ).toBe(false);
  });

  it("supports nested .harnessMutable patterns", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessMutableFile(
          `
settings.local.json
`,
          {
            isRoot: false,
            sourcePath: ".harness/resources/skills/review/.harnessMutable",
          }
        ).rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessMutable",
        isRoot: false,
      },
    ]);

    expect(
      matcher.isMutable(".harness/resources/skills/review/settings.local.json")
    ).toBe(true);
    expect(
      matcher.isMutable(".harness/resources/skills/triage/settings.local.json")
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
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
      }
    );
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parsed.rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
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
        code: "harness.ignore_mutable_section_unsupported",
        message: expect.stringContaining("[mutable .cursor]"),
      }),
    ]);
    expect(matcher.ignores(".harness/resources/skills/review/secret.md")).toBe(
      false
    );
    expect(matcher.ignores(".harness/resources/skills/review/shared.md")).toBe(
      true
    );
    expect(
      matcher.isMutable(".harness/resources/skills/review/state.json")
    ).toBe(false);

    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/.harnessIgnore",
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
      ".harness/resources/skills/review/.claude/.harnessIgnore",
      "[.claude]\nsecret.md\n"
    );

    const { ruleSets, diagnostics } = await loadHarnessIgnoreRuleSets(root);

    expect(
      ruleSets.find(
        (ruleSet) =>
          ruleSet.sourcePath ===
          ".harness/resources/skills/review/.claude/.harnessIgnore"
      )?.rules
    ).toEqual([]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "harness.ignore_unsupported_scope",
        path: ".harness/resources/skills/review/.claude/.harnessIgnore",
      }),
    ]);
  });

  it("emits unsupported-scope diagnostics for [!.cursor] inside a .claude override", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/.claude/.harnessIgnore",
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
      ".harness/resources/skills/review/.claude/.harnessIgnore",
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
      ".harness/resources/skills/review/.claude/.harnessIgnore",
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

  it("reports malformed target-output .harnessIgnore files during validation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/harness.toml",
      `
version = 1

[[targets]]
path = "./.agents"
`
    );
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".agents/skills/review/.harnessIgnore",
      "[.claude]\nsecret.md\n"
    );

    const validation = await validateHarnessConfig(root);

    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.ignore_unsupported_scope",
          path: ".agents/skills/review/.harnessIgnore",
        }),
      ])
    );
  });

  it("emits no diagnostic for [*] ignore and .harnessMutable inside an override", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await mkdir(path.join(root, ".harness"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/.claude/.harnessIgnore",
      "[*]\nshared.md\n"
    );
    await write(
      root,
      ".harness/resources/skills/review/.claude/.harnessMutable",
      "settings.local.json\n"
    );

    const { diagnostics } = await loadHarnessIgnoreRuleSets(root);

    expect(diagnostics).toEqual([]);
  });

  it("applies nested rules by directory locality", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile("secret.md\n", {
          isRoot: false,
          sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/resources/skills/review/secret.md")).toBe(
      true
    );
    expect(matcher.ignores(".harness/resources/skills/other/secret.md")).toBe(
      false
    );
  });

  it("detects implicit override target via detectImplicitOverrideTarget()", () => {
    expect(
      detectImplicitOverrideTarget(
        ".harness/resources/skills/review/.claude/.harnessIgnore"
      )
    ).toBe(".claude");
    expect(
      detectImplicitOverrideTarget(
        ".harness/resources/skills/review/.claude/nested/.harnessIgnore"
      )
    ).toBe(".claude");
    expect(
      detectImplicitOverrideTarget(".harness/resources/.gemini/.harnessIgnore")
    ).toBe(".gemini");
    expect(
      detectImplicitOverrideTarget(
        ".harness/resources/skills/review/.gemini/.harnessIgnore"
      )
    ).toBe(".gemini");
    expect(
      detectImplicitOverrideTarget(
        ".harness/resources/skills/review/nested/.claude/.harnessIgnore"
      )
    ).toBeUndefined();
    expect(
      detectImplicitOverrideTarget(
        ".harness/resources/skills/review/.harnessIgnore"
      )
    ).toBeUndefined();
    expect(
      detectImplicitOverrideTarget(
        "agent-context/resources/skills/review/.abc/.harnessIgnore",
        { resourcesPath: "./agent-context/resources" }
      )
    ).toBe(".abc");
  });

  it("scopes nested rules to the file's subtree (siblings unaffected)", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile("*.tmp", {
          isRoot: false,
          sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        }).rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(matcher.ignores(".harness/resources/skills/review/cache.tmp")).toBe(
      true
    );
    expect(matcher.ignores(".harness/resources/skills/triage/cache.tmp")).toBe(
      false
    );
  });

  it("ignores .harnessIgnore files themselves from projection by default", () => {
    const matcher = createHarnessIgnoreMatcher();

    expect(matcher.rules[0]).toEqual(
      expect.objectContaining({
        kind: "ignore",
        pattern: "**/.harnessIgnore",
      })
    );
    expect(
      matcher.ignores(".harness/resources/skills/review/.harnessIgnore")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/.harnessProfile")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/deploy/.harnessProfileRoot")
    ).toBe(true);
  });

  it("does not let user negation re-include harness declaration files", () => {
    const matcher = createHarnessIgnoreMatcher([
      {
        rules: parseHarnessIgnoreFile(
          "!.harnessIgnore\n!.harnessProfile\n!.harnessProfileRoot\n",
          {
            isRoot: false,
            sourcePath: ".harness/resources/skills/review/.harnessIgnore",
          }
        ).rules,
        directory: ".harness/resources/skills/review",
        sourcePath: ".harness/resources/skills/review/.harnessIgnore",
        isRoot: false,
      },
    ]);

    expect(
      matcher.ignores(".harness/resources/skills/review/.harnessIgnore")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/.harnessProfile")
    ).toBe(true);
    expect(
      matcher.ignores(".harness/resources/skills/review/.harnessProfileRoot")
    ).toBe(true);
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

  it("warns on multi-line .harnessProfile selectors and uses the first profile", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(root, ".harnessProfile", "\n personal \n team \n");
    await write(
      root,
      ".harness/profiles/personal/.harnessProfileRoot",
      "personal\n"
    );
    await write(root, ".harness/profiles/team/.harnessProfileRoot", "team\n");

    const context = await loadHarnessProfileContext(root);

    expect(context.profileForOutput(".agents/skills/review/SKILL.md")).toBe(
      "personal"
    );
    expect(context.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          code: "harness.profile_invalid",
          path: ".harnessProfile",
        }),
      ])
    );
  });

  it("errors on multi-line .harnessProfileRoot declarations and ignores that root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(
      root,
      ".harness/profiles/bad/.harnessProfileRoot",
      "personal\nteam\n"
    );

    const context = await loadHarnessProfileContext(root);

    expect(context.profileRoots).toEqual([]);
    expect(context.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.profile_invalid",
          path: ".harness/profiles/bad/.harnessProfileRoot",
        }),
      ])
    );
  });

  it("treats an empty .harnessProfile as selecting no profile without diagnostics", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harnessconfig-"));
    await write(root, ".harnessProfile", "\n");
    await write(root, ".agents/skills/.harnessProfile", "\n");
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
      undefined
    );
    expect(context.profileForOutput(".agents/skills/review/SKILL.md")).toBe(
      undefined
    );
  });

  it("treats ignore and mutable evaluations as independent", () => {
    const matcher = createHarnessIgnoreMatcher([
      ...parseHarnessMutable(`
.harness/**/settings.local.json
`),
      ...parseHarnessIgnore(`
.harness/**/*.log
`),
    ]);

    expect(matcher.ignores(".harness/resources/skills/x/run.log")).toBe(true);
    expect(matcher.isMutable(".harness/resources/skills/x/run.log")).toBe(
      false
    );
    expect(
      matcher.ignores(".harness/resources/skills/x/settings.local.json")
    ).toBe(false);
    expect(
      matcher.isMutable(".harness/resources/skills/x/settings.local.json")
    ).toBe(true);
  });
});
