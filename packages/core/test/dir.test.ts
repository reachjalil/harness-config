import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyHarnessActivation, planHarnessActivation } from "../src/index";

async function fixtureRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "harness-dir-"));
}

async function write(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function writeConfig(
  root: string,
  options: { targets?: string[]; dirPath?: string } = {}
) {
  const targets = options.targets ?? [];
  await write(
    root,
    ".harness/harness.toml",
    [
      "version = 1",
      "",
      ...targets.flatMap((target) => ["[[targets]]", `path = "${target}"`, ""]),
      "[dir]",
      `path = "${options.dirPath ?? "./.harness/dir"}"`,
      "",
    ].join("\n")
  );
}

describe("core dir (composable + copy)", () => {
  it("composes a leaf with .harnessComposable marker and numbered parts", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A\n");
    await write(root, ".harness/dir/AGENTS.md/200_rules.txt", "B\n");
    await write(
      root,
      ".harness/dir/.github/copilot-instructions.md/.harnessComposable",
      ""
    );
    await write(
      root,
      ".harness/dir/.github/copilot-instructions.md/100_intro.md",
      "C\n"
    );
    await write(root, ".harness/dir/PROMPT/.harnessComposable", "");
    await write(root, ".harness/dir/PROMPT/100_context", "P\n");

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A\nB\n"
    );
    await expect(
      readFile(path.join(root, ".github/copilot-instructions.md"), "utf8")
    ).resolves.toBe("C\n");
    await expect(readFile(path.join(root, "PROMPT"), "utf8")).resolves.toBe(
      "P\n"
    );
  });

  it("imports .harnessRef parts and sorts imported and local parts together", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/AGENTS.md/300_rules.md", "C");
    await write(root, ".harness/dir/CLAUDE.md/.harnessComposable", "");
    await write(root, ".harness/dir/CLAUDE.md/.harnessRef", "../AGENTS.md\n");
    await write(root, ".harness/dir/CLAUDE.md/250_claude_note.md", "B");

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "ABC"
    );
  });

  it("keeps duplicate numbers additive with imported parts before local parts", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_same.md", "A");
    await write(root, ".harness/dir/CLAUDE.md/.harnessComposable", "");
    await write(root, ".harness/dir/CLAUDE.md/.harnessRef", "../AGENTS.md\n");
    await write(root, ".harness/dir/CLAUDE.md/100_same.md", "B");

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "AB"
    );
  });

  it("lets a .harnessRef recipient ignore an imported composable part", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "Intro\n");
    await write(
      root,
      ".harness/dir/AGENTS.md/150_identity.md",
      "Use .agents\n"
    );
    await write(root, ".harness/dir/AGENTS.md/200_rules.md", "Rules\n");
    await write(root, ".harness/dir/CLAUDE.md/.harnessComposable", "");
    await write(root, ".harness/dir/CLAUDE.md/.harnessRef", "../AGENTS.md\n");
    await write(
      root,
      ".harness/dir/CLAUDE.md/.harnessIgnore",
      "AGENTS.md/150_identity.md\n"
    );
    await write(
      root,
      ".harness/dir/CLAUDE.md/150_identity.md",
      "Use .claude\n"
    );

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "Intro\nUse .claude\nRules\n"
    );
  });

  it("honors .harnessIgnore rules during dir composition", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(
      root,
      ".harnessIgnore",
      [
        ".harness/dir/AGENTS.md/200_skip.md",
        ".harness/dir/IGNORED.md/",
        "",
      ].join("\n")
    );
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/AGENTS.md/200_skip.md", "B");
    await write(root, ".harness/dir/IGNORED.md/.harnessComposable", "");
    await write(root, ".harness/dir/IGNORED.md/100_intro.md", "ignored");

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
    await expect(
      readFile(path.join(root, "IGNORED.md"), "utf8")
    ).rejects.toThrow();
  });

  it("applies a nested .harnessIgnore inside a composable leaf", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessIgnore", "200_skip.md\n");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/AGENTS.md/200_skip.md", "B");

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
  });

  it("applies nested .harnessIgnore inside a composable leaf outside .harness", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, { dirPath: "./resources" });
    await write(root, ".harnessIgnore", "");
    await write(root, "resources/AGENTS.md/.harnessComposable", "");
    await write(root, "resources/AGENTS.md/.harnessIgnore", "200_skip.md\n");
    await write(root, "resources/AGENTS.md/100_intro.md", "A");
    await write(root, "resources/AGENTS.md/200_skip.md", "B");

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
  });

  it("lets an active profile override composable parts with logical .harnessIgnore rules", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "my-profile\n");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "Base\n");
    await write(root, ".harness/dir/AGENTS.md/300_rules.md", "Rules\n");
    await write(
      root,
      ".harness/profiles/my-profile/.harnessProfileRoot",
      "my-profile\n"
    );
    await write(
      root,
      ".harness/profiles/my-profile/dir/AGENTS.md/.harnessIgnore",
      "100_intro.md\n"
    );
    await write(
      root,
      ".harness/profiles/my-profile/dir/AGENTS.md/100_my_intro.md",
      "Mine\n"
    );

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "Mine\nRules\n"
    );
  });

  it("applies a profile root nested inside a composable leaf", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "aggressive\n");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "Base\n");
    await write(
      root,
      ".harness/dir/AGENTS.md/aggressiveProfile/.harnessProfileRoot",
      "aggressive\n"
    );
    await write(
      root,
      ".harness/dir/AGENTS.md/aggressiveProfile/150_profile.md",
      "Profile\n"
    );

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "Base\nProfile\n"
    );
  });

  it("discovers target-output profile selectors during the final dir pass", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, "notes/.harnessProfile", "notes-profile\n");
    await write(root, ".harness/dir/notes/release.md/.harnessComposable", "");
    await write(root, ".harness/dir/notes/release.md/100_base.md", "Base\n");
    await write(
      root,
      ".harness/profiles/notes/.harnessProfileRoot",
      "notes-profile\n"
    );
    await write(
      root,
      ".harness/profiles/notes/dir/notes/release.md/200_profile.md",
      "Profile\n"
    );

    await applyHarnessActivation(root, { yes: true });

    await expect(
      readFile(path.join(root, "notes/release.md"), "utf8")
    ).resolves.toBe("Base\nProfile\n");
  });

  it("uses target-output profile selectors for profile-only dir outputs", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await mkdir(path.join(root, ".harness/dir"), { recursive: true });
    await write(root, ".harnessIgnore", "");
    await write(root, "notes/.harnessProfile", "notes-profile\n");
    await write(
      root,
      ".harness/profiles/notes/.harnessProfileRoot",
      "notes-profile\n"
    );
    await write(
      root,
      ".harness/profiles/notes/dir/notes/release.md/.harnessComposable",
      ""
    );
    await write(
      root,
      ".harness/profiles/notes/dir/notes/release.md/100_profile.md",
      "Profile\n"
    );
    await write(
      root,
      ".harness/profiles/notes/dir/notes/profile.txt",
      "copy\n"
    );

    const plan = await planHarnessActivation(root);

    expect(plan.dir.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "create",
          relativePath: "notes/release.md",
        }),
        expect.objectContaining({
          kind: "create",
          relativePath: "notes/profile.txt",
        }),
      ])
    );

    await applyHarnessActivation(root, { yes: true });

    await expect(
      readFile(path.join(root, "notes/release.md"), "utf8")
    ).resolves.toBe("Profile\n");
    await expect(
      readFile(path.join(root, "notes/profile.txt"), "utf8")
    ).resolves.toBe("copy\n");
  });

  it("applies physical ancestor ignores before profile roots overlay dir leaves", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/.keep", "");
    await write(root, ".harnessProfile", "deploy\n");
    await write(root, ".harness/kits/.harnessIgnore", "**/.harnex/\n");
    await write(root, ".harness/kits/deploy/.harnessProfileRoot", "deploy\n");
    await write(
      root,
      ".harness/kits/deploy/dir/AGENTS.md/.harnessComposable",
      ""
    );
    await write(root, ".harness/kits/deploy/dir/AGENTS.md/100_intro.md", "A");
    await write(
      root,
      ".harness/kits/deploy/dir/AGENTS.md/.harnex/meta.md",
      "metadata"
    );

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
  });

  it("applies target-located .harnessIgnore rules to dir copy outputs", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".agents/tools/.harnessIgnore", "*.tmp\n");
    await write(root, ".harness/dir/.agents/tools/drop.tmp", "drop");
    await write(root, ".harness/dir/.agents/tools/keep.txt", "keep");

    await applyHarnessActivation(root, { yes: true });

    await expect(
      readFile(path.join(root, ".agents/tools/drop.tmp"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/tools/keep.txt"), "utf8")
    ).resolves.toBe("keep");
  });

  it("applies target-output ancestor .harnessIgnore rules to composable dir outputs", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, "notes/.harnessIgnore", "release.md\n");
    await write(root, ".harness/dir/notes/release.md/.harnessComposable", "");
    await write(root, ".harness/dir/notes/release.md/100_intro.md", "release");

    const plan = await planHarnessActivation(root);

    expect(plan.dir.actions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "notes/release.md",
        }),
      ])
    );

    await applyHarnessActivation(root, { yes: true });
    await expect(
      readFile(path.join(root, "notes/release.md"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, "notes/.harnessIgnore"), "utf8")
    ).resolves.toBe("release.md\n");
  });

  it("reports invalid parts, mixed containers, symlinks, missing .harnessRef targets, outside .harnessRef targets, and cycles", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/BAD.md/.harnessComposable", "");
    await write(root, ".harness/dir/BAD.md/intro.md", "bad");
    await write(root, ".harness/dir/MIXED.md/.harnessComposable", "");
    await write(root, ".harness/dir/MIXED.md/100_intro.md", "bad");
    await write(root, ".harness/dir/MIXED.md/nested/100_intro.md", "bad");
    await write(root, ".harness/dir/MISSING.md/.harnessComposable", "");
    await write(root, ".harness/dir/MISSING.md/.harnessRef", "../NOPE.md\n");
    await write(root, ".harness/dir/OUTSIDE.md/.harnessComposable", "");
    await write(root, ".harness/dir/OUTSIDE.md/.harnessRef", "../../outside\n");
    await write(root, ".harness/dir/ABSOLUTE.md/.harnessComposable", "");
    await write(
      root,
      ".harness/dir/ABSOLUTE.md/.harnessRef",
      `${path.join(root, ".harness/dir/AGENTS.md")}\n`
    );
    await write(root, ".harness/dir/A.md/.harnessComposable", "");
    await write(root, ".harness/dir/A.md/.harnessRef", "../B.md\n");
    await write(root, ".harness/dir/B.md/.harnessComposable", "");
    await write(root, ".harness/dir/B.md/.harnessRef", "../A.md\n");
    await symlink(
      path.join(root, ".harness/dir/BAD.md/intro.md"),
      path.join(root, ".harness/dir/BAD.md/200_link.md")
    );

    const plan = await planHarnessActivation(root);
    const codes = plan.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain("harness.dir_invalid_part");
    expect(codes).toContain("harness.dir_mixed_container");
    expect(codes).toContain("harness.dir_invalid_entry");
    expect(codes).toContain("harness.dir_ref_missing");
    expect(codes).toContain("harness.dir_ref_absolute");
    expect(codes).toContain("harness.dir_ref_outside_root");
    expect(codes).toContain("harness.dir_ref_cycle");
  });

  it("reports create, update, and keep dir actions across activations", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");

    const createPlan = await planHarnessActivation(root);
    expect(createPlan.dir.actions[0]?.kind).toBe("create");

    await applyHarnessActivation(root, { yes: true });
    const keepPlan = await planHarnessActivation(root);
    expect(keepPlan.dir.actions[0]?.kind).toBe("keep");

    await write(root, "AGENTS.md", "local edit");
    const updatePlan = await planHarnessActivation(root);
    expect(updatePlan.dir.actions[0]?.kind).toBe("update");

    await applyHarnessActivation(root, { yes: true });
    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
  });

  it("replaces existing non-file destinations at dir output paths", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/LINKED.md/.harnessComposable", "");
    await write(root, ".harness/dir/LINKED.md/100_intro.md", "L");
    await mkdir(path.join(root, "AGENTS.md/nested"), { recursive: true });
    await write(root, "manual.txt", "manual");
    await symlink(path.join(root, "manual.txt"), path.join(root, "LINKED.md"));

    const plan = await planHarnessActivation(root);

    expect(plan.dir.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "update",
          relativePath: "AGENTS.md",
        }),
        expect.objectContaining({
          kind: "update",
          relativePath: "LINKED.md",
        }),
      ])
    );

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
    await expect(readFile(path.join(root, "LINKED.md"), "utf8")).resolves.toBe(
      "L"
    );
  });

  it("rejects dir outputs that overlap .harness or replace a declared target root", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, { targets: ["./.agents"] });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/dir/.harness/generated.md/.harnessComposable",
      ""
    );
    await write(root, ".harness/dir/.harness/generated.md/100_intro.md", "bad");
    // Dir output `.agents` itself would replace the target root.
    await write(root, ".harness/dir/.agents/.harnessComposable", "");
    await write(root, ".harness/dir/.agents/100_intro.md", "bad");

    const plan = await planHarnessActivation(root);
    const codes = plan.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain("harness.dir_output_inside_harness");
    expect(codes).toContain("harness.dir_output_target_overlap");
  });

  it("copies individual files when a directory has no marker", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/notes/README.md", "hello\n");
    await write(root, ".harness/dir/notes/nested/info.txt", "deep\n");
    await write(root, ".harness/dir/README.md", "root readme\n");

    await applyHarnessActivation(root, { yes: true });

    await expect(
      readFile(path.join(root, "notes/README.md"), "utf8")
    ).resolves.toBe("hello\n");
    await expect(
      readFile(path.join(root, "notes/nested/info.txt"), "utf8")
    ).resolves.toBe("deep\n");
    await expect(readFile(path.join(root, "README.md"), "utf8")).resolves.toBe(
      "root readme\n"
    );
  });

  it("never copies the .harnessComposable marker file itself", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");

    await applyHarnessActivation(root, { yes: true });

    await expect(
      readFile(path.join(root, ".harnessComposable"))
    ).rejects.toThrow();
  });

  it("merges dir outputs that fall under a declared target into that target", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, { targets: ["./.claude"] });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/.claude/settings.json", "{}");

    const plan = await planHarnessActivation(root);
    const claudeActions = plan.targets.find(
      (target) => target.path === "./.claude"
    )?.actions;
    expect(claudeActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "create",
          relativePath: "settings.json",
        }),
      ])
    );
    // Dir repo-root plan should have no .claude/settings.json — it was merged.
    expect(
      plan.dir.actions.some(
        (action) => action.relativePath === ".claude/settings.json"
      )
    ).toBe(false);

    await applyHarnessActivation(root, { yes: true });
    await expect(
      readFile(path.join(root, ".claude/settings.json"), "utf8")
    ).resolves.toBe("{}");
  });

  it("merges resource projection and dir outputs into the same managed target", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, {
      targets: ["./.agents"],
    });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".agents/skills/review/.harnessIgnore",
      "local-only.tmp\n"
    );
    await write(root, ".harness/resources/skills/review/SKILL.md", "resource");
    await write(root, ".harness/dir/.agents/skills/review/README.md", "dir");
    await write(
      root,
      ".harness/dir/.agents/skills/review/local-only.tmp",
      "drop"
    );

    const createPlan = await planHarnessActivation(root);
    const targetActions = createPlan.targets.find(
      (target) => target.path === "./.agents"
    )?.actions;
    expect(targetActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "create",
          relativePath: "skills/review/SKILL.md",
        }),
        expect.objectContaining({
          kind: "create",
          relativePath: "skills/review/README.md",
        }),
      ])
    );
    expect(targetActions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "skills/review/local-only.tmp",
        }),
      ])
    );
    expect(
      createPlan.dir.actions.some((action) =>
        action.relativePath.startsWith(".agents/")
      )
    ).toBe(false);

    await applyHarnessActivation(root, { yes: true });
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("resource");
    await expect(
      readFile(path.join(root, ".agents/skills/review/README.md"), "utf8")
    ).resolves.toBe("dir");
    await expect(
      readFile(path.join(root, ".agents/skills/review/local-only.tmp"), "utf8")
    ).rejects.toThrow();

    await write(root, ".agents/skills/review/manual.txt", "manual");
    const cleanupPlan = await planHarnessActivation(root, {
      cleanupUnmanaged: "remove",
    });
    const cleanupActions = cleanupPlan.targets.find(
      (target) => target.path === "./.agents"
    )?.actions;
    expect(cleanupActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "keep",
          relativePath: "skills/review/SKILL.md",
        }),
        expect.objectContaining({
          kind: "keep",
          relativePath: "skills/review/README.md",
        }),
        expect.objectContaining({
          kind: "remove",
          relativePath: "skills/review/manual.txt",
        }),
      ])
    );
    expect(cleanupActions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "skills/review/.harnessIgnore",
        }),
      ])
    );

    await applyHarnessActivation(root, {
      cleanupUnmanaged: "remove",
      yes: true,
    });
    await expect(
      readFile(path.join(root, ".agents/skills/review/manual.txt"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/skills/review/.harnessIgnore"), "utf8")
    ).resolves.toBe("local-only.tmp\n");
  });

  it("reports a conflict when a dir output collides with a resource projection", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, {
      targets: ["./.agents"],
    });
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/resources/skills/review/SKILL.md", "resource");
    await write(root, ".harness/dir/.agents/skills/review/SKILL.md", "dir");

    const plan = await planHarnessActivation(root);

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "harness.projection_path_conflict",
          path: ".harness/dir/.agents/skills/review/SKILL.md",
        }),
      ])
    );
    await expect(applyHarnessActivation(root, { yes: true })).rejects.toThrow(
      /validation has errors/
    );
  });

  it("applies target-output ignores to resources without suppressing unrelated dir outputs", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, {
      targets: ["./.agents"],
    });
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".agents/skills/review/.harnessIgnore",
      "agents-only.md\n"
    );
    await write(root, ".harness/resources/skills/review/SKILL.md", "resource");
    await write(
      root,
      ".harness/resources/skills/review/agents-only.md",
      "drop"
    );
    await write(root, ".harness/dir/.agents/notes/scoped.md", "dir");

    await applyHarnessActivation(root, { yes: true });

    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("resource");
    await expect(
      readFile(path.join(root, ".agents/skills/review/agents-only.md"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/notes/scoped.md"), "utf8")
    ).resolves.toBe("dir");
  });

  it("does nothing when [dir] is not declared even if a dir folder exists", async () => {
    const root = await fixtureRoot();
    await write(root, ".harness/harness.toml", ["version = 1", ""].join("\n"));
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");

    const plan = await planHarnessActivation(root);
    expect(plan.dir.enabled).toBe(false);
    expect(plan.dir.actions).toEqual([]);

    await applyHarnessActivation(root, { yes: true });
    await expect(readFile(path.join(root, "AGENTS.md"))).rejects.toThrow();
  });
});
