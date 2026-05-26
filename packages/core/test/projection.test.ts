import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyHarnessActivation,
  copyHarnessResourceItemProjection,
  harnessResourceItemProjectionMatchesTarget,
  planHarnessActivation,
} from "../src/index";

async function rootFixture(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "harness-projection-"));
}

async function write(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function writeHarnessConfig(
  root: string,
  options: {
    targets?: string[];
  } = {}
) {
  const targets = options.targets ?? ["./.agents"];
  const content = [
    "version = 1",
    "",
    ...targets.flatMap((target) => ["[[targets]]", `path = "${target}"`, ""]),
  ].join("\n");
  await write(root, ".harness/harness.toml", content);
}

describe("HarnessConfig activation projection", () => {
  it("projects the canonical .harness/resources tree without manifest resource declarations", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[[targets]]",
        'path = "./.agents"',
        "",
        "[[targets]]",
        'path = "./.gemini"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(root, ".harness/resources/hooks.json", "shared hooks");
    await write(
      root,
      ".harness/resources/skills/review/.gemini/SKILL.md",
      "gemini skill"
    );
    await write(root, ".harness/resources/.gemini/hooks.json", "gemini hooks");

    const result = await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
    });

    expect(result.plan.diagnostics).toEqual([]);
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("base");
    await expect(
      readFile(path.join(root, ".agents/hooks.json"), "utf8")
    ).resolves.toBe("shared hooks");
    await expect(
      readFile(path.join(root, ".gemini/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("gemini skill");
    await expect(
      readFile(path.join(root, ".gemini/hooks.json"), "utf8")
    ).resolves.toBe("gemini hooks");
    await expect(
      readFile(path.join(root, ".agents/.gemini/hooks.json"), "utf8")
    ).rejects.toThrow();
  });

  it("applies profile overlays to the canonical .harness/resources tree", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harness/harness.toml",
      ["version = 1", "", "[[targets]]", 'path = "./.agents"', ""].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "team\n");
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(root, ".harness/resources/hooks.json", "base hooks");
    await write(root, ".harness/profiles/team/.harnessProfileRoot", "team\n");
    await write(
      root,
      ".harness/profiles/team/resources/skills/review/PROFILE.md",
      "profile"
    );
    await write(
      root,
      ".harness/profiles/team/resources/hooks.json",
      "profile hooks"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("base");
    await expect(
      readFile(path.join(root, ".agents/skills/review/PROFILE.md"), "utf8")
    ).resolves.toBe("profile");
    await expect(
      readFile(path.join(root, ".agents/hooks.json"), "utf8")
    ).resolves.toBe("profile hooks");
  });

  it("applies portable profile roots nested inside canonical resource items", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harness/harness.toml",
      ["version = 1", "", "[[targets]]", 'path = "./.agents"', ""].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "aggressive\n");
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(
      root,
      ".harness/resources/skills/review/aggressiveProfile/.harnessProfileRoot",
      "aggressive\n"
    );
    await write(
      root,
      ".harness/resources/skills/review/aggressiveProfile/SKILL.md",
      "profile"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("profile");
    await expect(
      readFile(
        path.join(root, ".agents/skills/review/aggressiveProfile/SKILL.md"),
        "utf8"
      )
    ).rejects.toThrow();
  });

  it("projects one resource item with override and ignore semantics", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harnessIgnore",
      `
.harness/resources/skills/*/logs/
`
    );
    await write(
      root,
      ".claude/skills/review/.harnessIgnore",
      "agents-only.md\n"
    );
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(
      root,
      ".harness/resources/skills/review/agents-only.md",
      "agents only"
    );
    await write(
      root,
      ".harness/resources/skills/review/logs/run.log",
      "ignore"
    );
    await write(
      root,
      ".harness/resources/skills/review/.claude/SKILL.md",
      "claude"
    );

    await copyHarnessResourceItemProjection({
      root,
      sourceDir: ".harness/resources/skills/review",
      targetDir: ".claude/skills/review",
      targetPath: ".claude/skills",
    });

    await expect(
      readFile(path.join(root, ".claude/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("claude");
    await expect(
      readFile(path.join(root, ".claude/skills/review/agents-only.md"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".claude/skills/review/logs/run.log"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".claude/skills/review/.claude/SKILL.md"))
    ).rejects.toThrow();
    await expect(
      harnessResourceItemProjectionMatchesTarget({
        root,
        sourceDir: ".harness/resources/skills/review",
        targetDir: ".claude/skills/review",
        targetPath: ".claude/skills",
      })
    ).resolves.toBe(true);
  });

  it("honors a nested .harnessIgnore inside a resource item during item projection", async () => {
    const root = await rootFixture();
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/.harnessIgnore",
      "*.tmp\n"
    );
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(
      root,
      ".harness/resources/skills/review/scratch.tmp",
      "scratch"
    );

    await copyHarnessResourceItemProjection({
      root,
      sourceDir: ".harness/resources/skills/review",
      targetDir: ".agents/skills/review",
      targetPath: ".agents/skills",
    });

    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("base");
    await expect(
      readFile(path.join(root, ".agents/skills/review/scratch.tmp"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/review/.harnessIgnore"), "utf8")
    ).rejects.toThrow();
  });

  it("lets a nested rule re-include a file the root ignored", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harnessIgnore",
      ".harness/resources/skills/review/*.tmp\n"
    );
    await write(
      root,
      ".harness/resources/skills/review/.harnessIgnore",
      "!keep.tmp\n"
    );
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(root, ".harness/resources/skills/review/drop.tmp", "drop");
    await write(root, ".harness/resources/skills/review/keep.tmp", "keep");

    await copyHarnessResourceItemProjection({
      root,
      sourceDir: ".harness/resources/skills/review",
      targetDir: ".agents/skills/review",
      targetPath: ".agents/skills",
    });

    await expect(
      readFile(path.join(root, ".agents/skills/review/drop.tmp"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/review/keep.tmp"), "utf8")
    ).resolves.toBe("keep");
  });

  it("honors a target-output .harnessIgnore for one target", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents", "./.claude"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".claude/skills/review/.harnessIgnore", "secret.md\n");
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(root, ".harness/resources/skills/review/secret.md", "secret");

    const result = await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
    });

    expect(result.plan.diagnostics).toEqual([]);
    await expect(
      readFile(path.join(root, ".agents/skills/review/secret.md"), "utf8")
    ).resolves.toBe("secret");
    await expect(
      readFile(path.join(root, ".claude/skills/review/secret.md"), "utf8")
    ).rejects.toThrow();
  });

  it("honors target-located .harnessIgnore files against output paths", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents", "./.claude"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".agents/skills/deploy-plan/.harnessIgnore", "*.tmp\n");
    await write(
      root,
      ".harness/resources/skills/deploy-plan/SKILL.md",
      "deploy"
    );
    await write(
      root,
      ".harness/resources/skills/deploy-plan/scratch.tmp",
      "scratch"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/deploy-plan/SKILL.md"), "utf8")
    ).resolves.toBe("deploy");
    await expect(
      readFile(path.join(root, ".agents/skills/deploy-plan/scratch.tmp"))
    ).rejects.toThrow();
    await expect(
      readFile(
        path.join(root, ".claude/skills/deploy-plan/scratch.tmp"),
        "utf8"
      )
    ).resolves.toBe("scratch");
    await expect(
      readFile(
        path.join(root, ".agents/skills/deploy-plan/.harnessIgnore"),
        "utf8"
      )
    ).resolves.toBe("*.tmp\n");
  });

  it("preserves target-located .harnessIgnore during unmanaged cleanup", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/deploy-plan/SKILL.md",
      "deploy"
    );
    await write(root, ".agents/skills/deploy-plan/.harnessIgnore", "*.tmp\n");
    await write(root, ".agents/skills/deploy-plan/local.md", "local");

    const plan = await planHarnessActivation(root, {
      cleanupUnmanaged: "remove",
    });
    const actions = plan.targets.find(
      (target) => target.path === "./.agents"
    )?.actions;

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "remove",
          relativePath: "skills/deploy-plan/local.md",
        }),
      ])
    );
    expect(actions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "remove",
          relativePath: "skills/deploy-plan",
        }),
        expect.objectContaining({
          kind: "remove",
          relativePath: "skills/deploy-plan/.harnessIgnore",
        }),
      ])
    );

    await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
      cleanupUnmanaged: "remove",
    });

    await expect(
      readFile(
        path.join(root, ".agents/skills/deploy-plan/.harnessIgnore"),
        "utf8"
      )
    ).resolves.toBe("*.tmp\n");
    await expect(
      readFile(path.join(root, ".agents/skills/deploy-plan/local.md"))
    ).rejects.toThrow();
  });

  it("keeps target-output .harnessIgnore as the final output boundary", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "deploy\n");
    await write(root, ".agents/skills/review/.harnessIgnore", "secret.md\n");
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(root, ".harness/resources/skills/review/secret.md", "secret");
    await write(
      root,
      ".harness/profiles/deploy/.harnessProfileRoot",
      "deploy\n"
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/skills/review/.harnessIgnore",
      "!secret.md\n"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("base");
    await expect(
      readFile(path.join(root, ".agents/skills/review/secret.md"))
    ).rejects.toThrow();
  });

  it("keeps target overrides above generic active profile overlays", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.codex"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "deploy\n");
    await write(
      root,
      ".harness/resources/skills/basic-shapes/SKILL.md",
      "base"
    );
    await write(
      root,
      ".harness/resources/skills/basic-shapes/.codex/SKILL.md",
      "codex override"
    );
    await write(
      root,
      ".harness/profiles/deploy/.harnessProfileRoot",
      "deploy\n"
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/skills/basic-shapes/SKILL.md",
      "profile generic"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".codex/skills/basic-shapes/SKILL.md"), "utf8")
    ).resolves.toBe("codex override");
  });

  it("lets profile target overrides win after base target overrides", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.codex"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "deploy\n");
    await write(
      root,
      ".harness/resources/skills/basic-shapes/SKILL.md",
      "base"
    );
    await write(
      root,
      ".harness/resources/skills/basic-shapes/.codex/SKILL.md",
      "codex base override"
    );
    await write(
      root,
      ".harness/profiles/deploy/.harnessProfileRoot",
      "deploy\n"
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/skills/basic-shapes/SKILL.md",
      "profile generic"
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/skills/basic-shapes/.codex/SKILL.md",
      "profile codex override"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".codex/skills/basic-shapes/SKILL.md"), "utf8")
    ).resolves.toBe("profile codex override");
  });

  it("applies projection semantics to arbitrary resource kinds", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, {
      targets: ["./.codex"],
    });
    await write(
      root,
      ".harnessIgnore",
      [
        ".harness/resources/projects/demo/*.tmp",
        "!.harness/resources/projects/demo/keep.tmp",
        "",
      ].join("\n")
    );
    await write(root, ".codex/projects/demo/.harnessIgnore", "keep.tmp\n");
    await write(
      root,
      ".harness/resources/projects/demo/PROJECT.md",
      "base project"
    );
    await write(
      root,
      ".harness/resources/projects/demo/.codex/PROJECT.md",
      "codex"
    );
    await write(root, ".harness/resources/projects/demo/drop.tmp", "drop");
    await write(root, ".harness/resources/projects/demo/keep.tmp", "keep");

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".codex/projects/demo/PROJECT.md"), "utf8")
    ).resolves.toBe("codex");
    await expect(
      readFile(path.join(root, ".codex/projects/demo/drop.tmp"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".codex/projects/demo/keep.tmp"))
    ).rejects.toThrow();
  });

  it("applies physical ancestor ignores before profile roots overlay resources", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", ".harness/resources/skills/**\n");
    await write(root, ".harnessProfile", "deploy\n");
    await write(root, ".harness/kits/.harnessIgnore", "**/.harnex/\n");
    await write(root, ".harness/kits/deploy/.harnessProfileRoot", "deploy\n");
    await write(
      root,
      ".harness/kits/deploy/.harnessIgnore",
      "!skills/extra/**\n"
    );
    await write(
      root,
      ".harness/kits/deploy/resources/skills/extra/SKILL.md",
      "extra"
    );
    await write(
      root,
      ".harness/kits/deploy/resources/skills/extra/docs/.harnex/meta.md",
      "metadata"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/extra/SKILL.md"), "utf8")
    ).resolves.toBe("extra");
    await expect(
      readFile(path.join(root, ".agents/skills/extra/docs/.harnex/meta.md"))
    ).rejects.toThrow();
  });

  it("merges an active profile root under a resource root", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "deploy\n");
    await write(root, ".harness/resources/skills/base/SKILL.md", "base");
    await write(
      root,
      ".harness/resources/skills/deploy/.harnessProfileRoot",
      "deploy\n"
    );
    await write(
      root,
      ".harness/resources/skills/deploy/.harnessIgnore",
      "base/\n"
    );
    await write(
      root,
      ".harness/resources/skills/deploy/profiled/SKILL.md",
      "profiled"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/profiled/SKILL.md"), "utf8")
    ).resolves.toBe("profiled");
    await expect(
      readFile(path.join(root, ".agents/skills/base/SKILL.md"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/deploy/.harnessProfileRoot"))
    ).rejects.toThrow();
  });

  it("applies a profile root nested inside a resource item as a portable overlay", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "aggressive\n");
    await write(root, ".harness/resources/skills/example/SKILL.md", "base");
    await write(
      root,
      ".harness/resources/skills/example/aggressiveProfile/.harnessProfileRoot",
      "aggressive\n"
    );
    await write(
      root,
      ".harness/resources/skills/example/aggressiveProfile/SKILL.md",
      "aggressive"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/example/SKILL.md"), "utf8")
    ).resolves.toBe("aggressive");
    await expect(
      readFile(
        path.join(root, ".agents/skills/example/aggressiveProfile/SKILL.md")
      )
    ).rejects.toThrow();
  });

  it("warns when multiple active profile roots project the same file", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "deploy\n");
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(root, ".harness/kits/a/.harnessProfileRoot", "deploy\n");
    await write(root, ".harness/kits/a/resources/skills/review/SKILL.md", "a");
    await write(
      root,
      ".harness/kits/a/resources/skills/review/CONFLICT.md",
      "a"
    );
    await write(root, ".harness/kits/b/.harnessProfileRoot", "deploy\n");
    await write(root, ".harness/kits/b/resources/skills/review/SKILL.md", "b");
    await write(
      root,
      ".harness/kits/b/resources/skills/review/CONFLICT.md",
      "b"
    );

    const plan = await planHarnessActivation(root);

    const conflictWarnings = plan.diagnostics.filter(
      (diagnostic) => diagnostic.code === "harness.profile_overlay_conflict"
    );
    expect(conflictWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          path: ".harness/kits/b/resources/skills/review/SKILL.md",
        }),
        expect.objectContaining({
          severity: "warning",
          path: ".harness/kits/b/resources/skills/review/CONFLICT.md",
        }),
      ])
    );

    const result = await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
    });
    expect(
      result.plan.diagnostics.filter(
        (diagnostic) => diagnostic.code === "harness.profile_overlay_conflict"
      )
    ).toHaveLength(2);
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("b");
    await expect(
      readFile(path.join(root, ".agents/skills/review/CONFLICT.md"), "utf8")
    ).resolves.toBe("b");
  });

  it("reports profile diagnostics once during activation planning", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/profiles/bad/.harnessProfileRoot", "\n");

    const plan = await planHarnessActivation(root);

    expect(
      plan.diagnostics.filter(
        (diagnostic) => diagnostic.code === "harness.profile_empty"
      )
    ).toHaveLength(1);
  });

  it("applies target-local profile selection to only that output subtree", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, {
      targets: ["./.agents"],
    });
    await write(root, ".harnessIgnore", "");
    await write(root, ".agents/skills/.harnessProfile", "deploy\n");
    await write(root, ".agents/skills/local.md", "local");
    await write(
      root,
      ".harness/profiles/deploy/.harnessProfileRoot",
      "deploy\n"
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/skills/profiled/SKILL.md",
      "profiled skill"
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/rules/profiled/RULE.md",
      "profiled rule"
    );

    await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
      cleanupUnmanaged: "remove",
    });

    await expect(
      readFile(path.join(root, ".agents/skills/profiled/SKILL.md"), "utf8")
    ).resolves.toBe("profiled skill");
    await expect(
      readFile(path.join(root, ".agents/rules/profiled/RULE.md"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/.harnessProfile"), "utf8")
    ).resolves.toBe("deploy\n");
    await expect(
      readFile(path.join(root, ".agents/skills/local.md"))
    ).rejects.toThrow();
  });

  it("reports unsupported target-scoped headers inside an override .harnessIgnore", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.claude"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "base");
    await write(
      root,
      ".harness/resources/skills/review/.claude/SKILL.md",
      "claude"
    );
    await write(
      root,
      ".harness/resources/skills/review/.claude/scratch.tmp",
      "tmp"
    );
    await write(
      root,
      ".harness/resources/skills/review/.claude/.harnessIgnore",
      "[.cursor]\n*.tmp\n"
    );

    const plan = await planHarnessActivation(root);

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.ignore_unsupported_scope",
          path: ".harness/resources/skills/review/.claude/.harnessIgnore",
        }),
      ])
    );
  });

  it("propagates root ignore rules into deeply nested resource items", async () => {
    const root = await rootFixture();
    await write(root, ".harnessIgnore", ".harness/**/logs/\n");
    await write(
      root,
      ".harness/resources/skills/review/deep/logs/run.log",
      "log"
    );
    await write(root, ".harness/resources/skills/review/deep/KEEP.md", "keep");

    await copyHarnessResourceItemProjection({
      root,
      sourceDir: ".harness/resources/skills/review",
      targetDir: ".agents/skills/review",
      targetPath: ".agents/skills",
    });

    await expect(
      readFile(path.join(root, ".agents/skills/review/deep/logs/run.log"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/review/deep/KEEP.md"), "utf8")
    ).resolves.toBe("keep");
  });

  it("plans and applies a repeatable copy projection with overrides and target-output ignores", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents", "./.claude"] });
    await write(
      root,
      ".harnessIgnore",
      `
.harness/**/logs/
`
    );
    await write(
      root,
      ".claude/skills/review/.harnessIgnore",
      "agents-only.md\n"
    );
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "base skill"
    );
    await write(
      root,
      ".harness/resources/skills/review/agents-only.md",
      "agents only"
    );
    await write(
      root,
      ".harness/resources/skills/review/logs/run.log",
      "ignored"
    );
    await write(
      root,
      ".harness/resources/skills/review/.agents/SKILL.md",
      "agents skill"
    );
    await write(
      root,
      ".harness/resources/skills/review/.claude/SKILL.md",
      "claude skill"
    );

    const dryRun = await applyHarnessActivation(root);
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.plan.idempotent).toBe(true);
    expect(
      dryRun.plan.targets
        .find((target) => target.path === "./.agents")
        ?.actions.some((action) => action.kind === "create")
    ).toBe(true);

    const result = await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
    });

    expect(result.dryRun).toBe(false);
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("agents skill");
    await expect(
      readFile(path.join(root, ".claude/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("claude skill");
    await expect(
      readFile(path.join(root, ".agents/skills/review/agents-only.md"), "utf8")
    ).resolves.toBe("agents only");
    await expect(
      readFile(path.join(root, ".claude/skills/review/agents-only.md"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/review/logs/run.log"), "utf8")
    ).rejects.toThrow();

    const secondPlan = await planHarnessActivation(root);
    expect(
      secondPlan.targets.flatMap((target) =>
        target.actions.map((action) => action.kind)
      )
    ).toEqual(["keep", "keep", "keep"]);
  });

  it("copies every declared target even when computed projections match", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents", "./.cursor"] });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "shared skill"
    );

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets.find((target) => target.path === "./.cursor")
    ).toMatchObject({
      strategy: "copy",
    });

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    const cursorState = await lstat(path.join(root, ".cursor"));
    expect(cursorState.isDirectory()).toBe(true);
    expect(cursorState.isSymbolicLink()).toBe(false);
    await expect(
      readFile(path.join(root, ".cursor/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("shared skill");

    const secondPlan = await planHarnessActivation(root);
    expect(
      secondPlan.targets.find((target) => target.path === "./.cursor")?.actions
    ).toEqual([
      expect.objectContaining({
        kind: "keep",
        relativePath: "skills/review/SKILL.md",
      }),
    ]);
  });

  it("does not project anything when no targets are declared", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: [] });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "shared skill"
    );

    const plan = await planHarnessActivation(root);

    expect(plan.targets).toEqual([]);
  });

  it("merges nested override folders and target-output ignores across resource kinds", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, {
      targets: ["./.agents", "./.claude", "./.cursor"],
    });
    await write(
      root,
      ".harnessIgnore",
      `
.harness/resources/plugins/*/logs/
`
    );
    await write(
      root,
      ".agents/plugins/review-pack/hooks/.harnessIgnore",
      "hooks.json\n"
    );
    await write(
      root,
      ".agents/plugins/review-pack/.harnessIgnore",
      "not-cursor.md\n"
    );
    await write(
      root,
      ".claude/plugins/review-pack/.harnessIgnore",
      "not-cursor.md\n"
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/PLUGIN.md",
      "portable"
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/assets/README.md",
      "shared asset"
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/not-cursor.md",
      "cursor-only by target-output ignore"
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/logs/run.log",
      "source-only log"
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/.agents/.codex-plugin/plugin.json",
      '{"runtime":"codex"}'
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/.agents/hooks/hooks.json",
      '{"hidden":"agents-scoped-ignore"}'
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/.claude/.claude-plugin/plugin.json",
      '{"runtime":"claude"}'
    );
    await write(
      root,
      ".harness/resources/plugins/review-pack/.claude/skills/review/SKILL.md",
      "claude nested skill"
    );
    await write(
      root,
      ".harness/resources/prompts/triage/PROMPT.md",
      "portable prompt"
    );
    await write(
      root,
      ".harness/resources/prompts/triage/.claude/PROMPT.md",
      "claude prompt"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    await expect(
      readFile(path.join(root, ".agents/plugins/review-pack/PLUGIN.md"), "utf8")
    ).resolves.toBe("portable");
    await expect(
      readFile(
        path.join(
          root,
          ".agents/plugins/review-pack/.codex-plugin/plugin.json"
        ),
        "utf8"
      )
    ).resolves.toContain("codex");
    await expect(
      readFile(path.join(root, ".agents/plugins/review-pack/hooks/hooks.json"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/plugins/review-pack/not-cursor.md"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/plugins/review-pack/logs/run.log"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/plugins/review-pack/.claude/PLUGIN.md"))
    ).rejects.toThrow();

    await expect(
      readFile(
        path.join(
          root,
          ".claude/plugins/review-pack/.claude-plugin/plugin.json"
        ),
        "utf8"
      )
    ).resolves.toContain("claude");
    await expect(
      readFile(
        path.join(root, ".claude/plugins/review-pack/skills/review/SKILL.md"),
        "utf8"
      )
    ).resolves.toBe("claude nested skill");
    await expect(
      readFile(path.join(root, ".claude/prompts/triage/PROMPT.md"), "utf8")
    ).resolves.toBe("claude prompt");
    await expect(
      readFile(path.join(root, ".claude/plugins/review-pack/not-cursor.md"))
    ).rejects.toThrow();

    await expect(
      readFile(
        path.join(root, ".cursor/plugins/review-pack/not-cursor.md"),
        "utf8"
      )
    ).resolves.toBe("cursor-only by target-output ignore");
    await expect(
      readFile(path.join(root, ".cursor/prompts/triage/PROMPT.md"), "utf8")
    ).resolves.toBe("portable prompt");

    const secondPlan = await planHarnessActivation(root);
    expect(
      secondPlan.targets.flatMap((target) =>
        target.actions.filter((action) => action.kind !== "keep")
      )
    ).toEqual([]);
  });

  it("keeps unmanaged target entries by default and reports them at one level", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "projected");
    await write(root, ".agents/skills/manual/SKILL.md", "manual skill");
    await write(root, ".agents/skills/manual/logs/run.log", "manual log");
    await write(root, ".agents/skills/review/local.md", "local note");

    const plan = await planHarnessActivation(root);
    const agentsActions = plan.targets.find(
      (target) => target.path === "./.agents"
    )?.actions;

    expect(agentsActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "create",
          relativePath: "skills/review/SKILL.md",
        }),
        expect.objectContaining({
          kind: "preserve",
          relativePath: "skills/manual",
        }),
        expect.objectContaining({
          kind: "preserve",
          relativePath: "skills/review/local.md",
        }),
      ])
    );
    expect(
      agentsActions?.filter((action) => action.relativePath === "skills/manual")
    ).toHaveLength(1);

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await expect(
      readFile(path.join(root, ".agents/skills/manual/SKILL.md"), "utf8")
    ).resolves.toBe("manual skill");
    await expect(
      readFile(path.join(root, ".agents/skills/review/local.md"), "utf8")
    ).resolves.toBe("local note");
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("projected");
  });

  it("removes unmanaged target entries only when cleanup is requested", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "projected");
    await write(root, ".agents/skills/manual/SKILL.md", "manual skill");
    await write(root, ".agents/skills/review/local.md", "local note");

    const plan = await planHarnessActivation(root, {
      cleanupUnmanaged: "remove",
    });
    const agentsActions = plan.targets.find(
      (target) => target.path === "./.agents"
    )?.actions;

    expect(agentsActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "remove",
          relativePath: "skills/manual",
        }),
        expect.objectContaining({
          kind: "remove",
          relativePath: "skills/review/local.md",
        }),
      ])
    );

    await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
      cleanupUnmanaged: "remove",
    });
    await expect(
      readFile(path.join(root, ".agents/skills/manual/SKILL.md"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/review/local.md"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("projected");
  });

  it("reports updates and requested removals before converging after apply", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "first");

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await write(root, ".harness/resources/skills/review/SKILL.md", "second");
    await write(root, ".agents/skills/review/stale.md", "stale");

    const plan = await planHarnessActivation(root, {
      cleanupUnmanaged: "remove",
    });
    const agentsActions = plan.targets.find(
      (target) => target.path === "./.agents"
    )?.actions;

    expect(agentsActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "update",
          relativePath: "skills/review/SKILL.md",
        }),
        expect.objectContaining({
          kind: "remove",
          relativePath: "skills/review/stale.md",
        }),
      ])
    );

    await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
      cleanupUnmanaged: "remove",
    });
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("second");
    await expect(
      readFile(path.join(root, ".agents/skills/review/stale.md"))
    ).rejects.toThrow();

    const secondPlan = await planHarnessActivation(root, {
      cleanupUnmanaged: "remove",
    });
    expect(
      secondPlan.targets.flatMap((target) =>
        target.actions.map((action) => action.kind)
      )
    ).toEqual(["keep"]);
  });

  it("reports an existing target symlink as unsupported", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.cursor"] });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "shared skill"
    );
    await symlink(
      path.relative(path.join(root), path.join(root, ".agents")),
      path.join(root, ".cursor"),
      "dir"
    );

    const plan = await planHarnessActivation(root);
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.target_symlink_unsupported",
          path: ".cursor",
        }),
      ])
    );
    expect(
      plan.targets.find((target) => target.path === "./.cursor")?.actions
    ).toEqual([]);

    await expect(
      applyHarnessActivation(root, { dryRun: false, yes: true })
    ).rejects.toThrow(/validation has errors/);
  });

  it("reports nested target symlinks as unsupported", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "shared skill"
    );
    await write(root, "outside.md", "outside");
    await mkdir(path.join(root, ".agents/skills/review"), { recursive: true });
    await symlink(
      path.join(root, "outside.md"),
      path.join(root, ".agents/skills/review/LINK.md")
    );

    const plan = await planHarnessActivation(root);
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.target_symlink_unsupported",
          path: ".agents/skills/review/LINK.md",
        }),
      ])
    );

    await expect(
      applyHarnessActivation(root, { dryRun: false, yes: true })
    ).rejects.toThrow(/validation has errors/);
  });

  it("replaces an existing non-directory target root with a copy projection", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "projected");
    await write(root, ".agents", "not a directory");

    const plan = await planHarnessActivation(root);

    expect(plan.targets.find((target) => target.path === "./.agents")).toEqual(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            kind: "remove",
            reason: "replace existing non-directory with copy projection",
          }),
          expect.objectContaining({
            kind: "create",
            relativePath: "skills/review/SKILL.md",
          }),
        ]),
      })
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    const agentsState = await lstat(path.join(root, ".agents"));
    expect(agentsState.isDirectory()).toBe(true);
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("projected");
  });

  it("does not rewrite files that are already reported as keep", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "stable");

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    const target = path.join(root, ".agents/skills/review/SKILL.md");
    const oldTime = new Date("2000-01-01T00:00:00.000Z");
    await utimes(target, oldTime, oldTime);

    const plan = await planHarnessActivation(root);
    expect(plan.targets[0]?.actions).toEqual([
      expect.objectContaining({
        kind: "keep",
        relativePath: "skills/review/SKILL.md",
      }),
    ]);

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    const targetStat = await stat(target);
    expect(targetStat.mtime.getUTCFullYear()).toBe(2000);
  });

  it("reports override file and directory conflicts before apply", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/hooks/config.json",
      "{}"
    );
    await write(
      root,
      ".harness/resources/skills/review/.agents/hooks",
      "not a dir"
    );

    const plan = await planHarnessActivation(root);

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.projection_path_conflict",
        }),
      ])
    );
    await expect(
      applyHarnessActivation(root, { dryRun: false, yes: true })
    ).rejects.toThrow(/validation has errors/);
  });

  it("reports canonical file and override directory conflicts before apply", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/hooks", "not a dir");
    await write(
      root,
      ".harness/resources/skills/review/.agents/hooks/config.json",
      "{}"
    );

    const plan = await planHarnessActivation(root);

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "harness.projection_path_conflict",
        }),
      ])
    );
    await expect(
      applyHarnessActivation(root, { dryRun: false, yes: true })
    ).rejects.toThrow(/validation has errors/);
  });

  it("creates mutable files on first activation and skips them afterwards", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(
      root,
      ".harnessIgnore",
      "[mutable]\n.harness/**/settings.local.json\n"
    );
    await write(
      root,
      ".harness/resources/skills/review/settings.local.json",
      '{"allow":[]}'
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await expect(
      readFile(
        path.join(root, ".agents/skills/review/settings.local.json"),
        "utf8"
      )
    ).resolves.toBe('{"allow":[]}');

    await writeFile(
      path.join(root, ".agents/skills/review/settings.local.json"),
      '{"allow":["bash"]}',
      "utf8"
    );

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/settings.local.json"
      )
    ).toEqual(
      expect.objectContaining({
        kind: "mutable",
        relativePath: "skills/review/settings.local.json",
      })
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await expect(
      readFile(
        path.join(root, ".agents/skills/review/settings.local.json"),
        "utf8"
      )
    ).resolves.toBe('{"allow":["bash"]}');
  });

  it("reports existing mutable files as mutable even when bytes still match", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(
      root,
      ".harnessIgnore",
      "[mutable]\n.harness/**/settings.local.json\n"
    );
    await write(
      root,
      ".harness/resources/skills/review/settings.local.json",
      '{"allow":[]}'
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/settings.local.json"
      )
    ).toEqual(
      expect.objectContaining({
        kind: "mutable",
        relativePath: "skills/review/settings.local.json",
      })
    );
  });

  it("--force-mutable re-projects mutable files from source", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(
      root,
      ".harnessIgnore",
      "[mutable]\n.harness/**/settings.local.json\n"
    );
    await write(
      root,
      ".harness/resources/skills/review/settings.local.json",
      '{"allow":[]}'
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await writeFile(
      path.join(root, ".agents/skills/review/settings.local.json"),
      '{"allow":["bash"]}',
      "utf8"
    );

    const plan = await planHarnessActivation(root, { mutablePolicy: "force" });
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/settings.local.json"
      )
    ).toEqual(
      expect.objectContaining({
        kind: "update",
        relativePath: "skills/review/settings.local.json",
        reason: expect.stringContaining("force-mutable"),
      })
    );

    await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
      mutablePolicy: "force",
    });
    await expect(
      readFile(
        path.join(root, ".agents/skills/review/settings.local.json"),
        "utf8"
      )
    ).resolves.toBe('{"allow":[]}');
  });

  it("lets ignore rules win over mutable rules during projection", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(
      root,
      ".harnessIgnore",
      [
        "[mutable]",
        ".harness/**/settings.local.json",
        "",
        "[*]",
        ".harness/**/settings.local.json",
        "",
      ].join("\n")
    );
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );
    await write(
      root,
      ".harness/resources/skills/review/settings.local.json",
      '{"allow":[]}'
    );

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets[0]?.actions.some(
        (action) => action.relativePath === "skills/review/settings.local.json"
      )
    ).toBe(false);

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await expect(
      readFile(path.join(root, ".agents/skills/review/settings.local.json"))
    ).rejects.toThrow();
  });

  it("reports target byte changes as updates by direct comparison", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await writeFile(
      path.join(root, ".agents/skills/review/SKILL.md"),
      "edited by runtime",
      "utf8"
    );

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/SKILL.md"
      )
    ).toEqual(
      expect.objectContaining({
        kind: "update",
        relativePath: "skills/review/SKILL.md",
      })
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("review skill");
  });

  it("treats source updates as update when target differs from current projection", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "first");

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await write(root, ".harness/resources/skills/review/SKILL.md", "second");

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/SKILL.md"
      )?.kind
    ).toBe("update");
  });

  it("removes stale projected files when source deletion and cleanup are explicit", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await rm(path.join(root, ".harness/resources/skills/review/SKILL.md"));

    const plan = await planHarnessActivation(root, {
      cleanupUnmanaged: "remove",
    });
    expect(plan.targets[0]?.actions).toEqual([
      expect.objectContaining({
        kind: "remove",
        relativePath: "skills/review",
      }),
    ]);

    await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
      cleanupUnmanaged: "remove",
    });
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).rejects.toThrow();

    const secondPlan = await planHarnessActivation(root, {
      cleanupUnmanaged: "remove",
    });
    expect(secondPlan.targets[0]?.actions).toEqual([]);
  });
});
