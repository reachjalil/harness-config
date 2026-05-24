import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
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
    resources?: string[];
    targets?: string[];
  } = {}
) {
  const resources = options.resources ?? ["skills"];
  const targets = options.targets ?? ["./.agents"];
  const content = [
    "version = 1",
    "",
    ...resources.flatMap((resource) => [
      `[resources.${resource}]`,
      `path = "./.harness/${resource}"`,
      "",
    ]),
    ...targets.flatMap((target) => ["[[targets]]", `path = "${target}"`, ""]),
  ].join("\n");
  await write(root, ".harness/harness.toml", content);
}

describe("HarnessConfig activation projection", () => {
  it("projects one resource item with override and ignore semantics", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harnessIgnore",
      `
.harness/skills/*/logs/

[.claude]
.harness/skills/*/agents-only.md
`
    );
    await write(root, ".harness/skills/review/SKILL.md", "base");
    await write(root, ".harness/skills/review/agents-only.md", "agents only");
    await write(root, ".harness/skills/review/logs/run.log", "ignore");
    await write(root, ".harness/skills/review/.claude/SKILL.md", "claude");

    await copyHarnessResourceItemProjection({
      root,
      sourceDir: ".harness/skills/review",
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
        sourceDir: ".harness/skills/review",
        targetDir: ".claude/skills/review",
        targetPath: ".claude/skills",
      })
    ).resolves.toBe(true);
  });

  it("plans and applies a repeatable copy projection with overrides and scoped ignores", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents", "./.claude"] });
    await write(
      root,
      ".harnessIgnore",
      `
.harness/**/logs/

[.claude]
.harness/skills/*/agents-only.md
`
    );
    await write(root, ".harness/skills/review/SKILL.md", "base skill");
    await write(root, ".harness/skills/review/agents-only.md", "agents only");
    await write(root, ".harness/skills/review/logs/run.log", "ignored");
    await write(
      root,
      ".harness/skills/review/.agents/SKILL.md",
      "agents skill"
    );
    await write(
      root,
      ".harness/skills/review/.claude/SKILL.md",
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
    await write(root, ".harness/skills/review/SKILL.md", "shared skill");

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
    await write(root, ".harness/skills/review/SKILL.md", "shared skill");

    const plan = await planHarnessActivation(root);

    expect(plan.targets).toEqual([]);
  });

  it("merges nested override folders and scoped ignores across resource kinds", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, {
      resources: ["skills", "plugins", "prompts"],
      targets: ["./.agents", "./.claude", "./.cursor"],
    });
    await write(
      root,
      ".harnessIgnore",
      `
.harness/plugins/*/logs/

[.agents]
.harness/plugins/*/.agents/hooks/

[!.cursor]
.harness/plugins/*/not-cursor.md
`
    );
    await write(root, ".harness/plugins/review-pack/PLUGIN.md", "portable");
    await write(
      root,
      ".harness/plugins/review-pack/assets/README.md",
      "shared asset"
    );
    await write(
      root,
      ".harness/plugins/review-pack/not-cursor.md",
      "cursor-only by scoped ignore"
    );
    await write(
      root,
      ".harness/plugins/review-pack/logs/run.log",
      "source-only log"
    );
    await write(
      root,
      ".harness/plugins/review-pack/.agents/.codex-plugin/plugin.json",
      '{"runtime":"codex"}'
    );
    await write(
      root,
      ".harness/plugins/review-pack/.agents/hooks/hooks.json",
      '{"hidden":"agents-scoped-ignore"}'
    );
    await write(
      root,
      ".harness/plugins/review-pack/.claude/.claude-plugin/plugin.json",
      '{"runtime":"claude"}'
    );
    await write(
      root,
      ".harness/plugins/review-pack/.claude/skills/review/SKILL.md",
      "claude nested skill"
    );
    await write(root, ".harness/prompts/triage/PROMPT.md", "portable prompt");
    await write(
      root,
      ".harness/prompts/triage/.claude/PROMPT.md",
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
    ).resolves.toBe("cursor-only by scoped ignore");
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
    await write(root, ".harness/skills/review/SKILL.md", "projected");
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
    await write(root, ".harness/skills/review/SKILL.md", "projected");
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
    await write(root, ".harness/skills/review/SKILL.md", "first");

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await write(root, ".harness/skills/review/SKILL.md", "second");
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

  it("replaces an existing target symlink with a copy projection", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.cursor"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "shared skill");
    await symlink(
      path.relative(path.join(root), path.join(root, ".agents")),
      path.join(root, ".cursor"),
      "dir"
    );

    const plan = await planHarnessActivation(root);
    expect(plan.targets.find((target) => target.path === "./.cursor")).toEqual(
      expect.objectContaining({
        strategy: "copy",
        actions: expect.arrayContaining([
          expect.objectContaining({
            kind: "remove",
            reason: "replace symlink with copy projection",
          }),
          expect.objectContaining({
            kind: "create",
            relativePath: "skills/review/SKILL.md",
          }),
        ]),
      })
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    const cursorState = await lstat(path.join(root, ".cursor"));
    expect(cursorState.isDirectory()).toBe(true);
    expect(cursorState.isSymbolicLink()).toBe(false);
    await expect(
      readFile(path.join(root, ".cursor/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("shared skill");
  });

  it("replaces an existing non-directory target root with a copy projection", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "projected");
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
    await write(root, ".harness/skills/review/SKILL.md", "stable");

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
    await write(root, ".harness/skills/review/hooks/config.json", "{}");
    await write(root, ".harness/skills/review/.agents/hooks", "not a dir");

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
    await write(root, ".harness/skills/review/hooks", "not a dir");
    await write(root, ".harness/skills/review/.agents/hooks/config.json", "{}");

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
      ".harness/skills/review/settings.local.json",
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
      ".harness/skills/review/settings.local.json",
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

  it("reports drift when a managed target file is modified after apply", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "review skill");

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
        kind: "drift",
        relativePath: "skills/review/SKILL.md",
        reason: expect.stringContaining("modified after last activation"),
      })
    );

    // Default apply leaves drift in place.
    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("edited by runtime");
  });

  it("keeps reporting drift after a default apply skips a drifted file", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "review skill");

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await writeFile(
      path.join(root, ".agents/skills/review/SKILL.md"),
      "edited by runtime",
      "utf8"
    );

    await applyHarnessActivation(root, { dryRun: false, yes: true });

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/SKILL.md"
      )
    ).toEqual(
      expect.objectContaining({
        kind: "drift",
        relativePath: "skills/review/SKILL.md",
      })
    );
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("edited by runtime");
  });

  it("--accept-drift overwrites drifted files with the projection", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "review skill");

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    await writeFile(
      path.join(root, ".agents/skills/review/SKILL.md"),
      "edited by runtime",
      "utf8"
    );

    const plan = await planHarnessActivation(root, { driftPolicy: "accept" });
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/SKILL.md"
      )
    ).toEqual(
      expect.objectContaining({
        kind: "update",
        relativePath: "skills/review/SKILL.md",
        reason: expect.stringContaining("accept-drift"),
      })
    );

    await applyHarnessActivation(root, {
      dryRun: false,
      yes: true,
      driftPolicy: "accept",
    });
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("review skill");
  });

  it("treats source updates as 'update' rather than drift when target matches manifest", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "first");

    await applyHarnessActivation(root, { dryRun: false, yes: true });
    // source changes; target untouched
    await write(root, ".harness/skills/review/SKILL.md", "second");

    const plan = await planHarnessActivation(root);
    expect(
      plan.targets[0]?.actions.find(
        (action) => action.relativePath === "skills/review/SKILL.md"
      )?.kind
    ).toBe("update");
  });

  it("rejects resources or targets that point at .harness/.state", async () => {
    const root = await rootFixture();
    await writeHarnessConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    // Overwrite with a config that points a resource at the reserved dir.
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[resources.skills]",
        'path = "./.harness/.state"',
        "",
        "[[targets]]",
        'path = "./.agents"',
        "",
      ].join("\n")
    );

    const plan = await planHarnessActivation(root);
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "harness.resource_reserved_state_path",
        }),
      ])
    );

    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[resources.skills]",
        'path = "./.harness/skills"',
        "",
        "[[targets]]",
        'path = "./.harness/.state"',
        "",
      ].join("\n")
    );

    const targetPlan = await planHarnessActivation(root);
    expect(targetPlan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "harness.config_invalid",
          message: expect.stringContaining(".harness/.state"),
        }),
      ])
    );
  });
});
