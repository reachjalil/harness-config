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

  it("imports ref parts and sorts imported and local parts together", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/AGENTS.md/300_rules.md", "C");
    await write(root, ".harness/dir/CLAUDE.md/.harnessComposable", "");
    await write(root, ".harness/dir/CLAUDE.md/.ref", "../AGENTS.md\n");
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
    await write(root, ".harness/dir/CLAUDE.md/.ref", "../AGENTS.md\n");
    await write(root, ".harness/dir/CLAUDE.md/100_same.md", "B");

    await applyHarnessActivation(root, { yes: true });

    await expect(readFile(path.join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "AB"
    );
  });

  it("honors only global .harnessIgnore rules during dir composition", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(
      root,
      ".harnessIgnore",
      [
        "[.claude]",
        ".harness/dir/AGENTS.md/100_intro.md",
        "[*]",
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

  it("reports invalid parts, mixed containers, symlinks, missing refs, outside refs, and cycles", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/BAD.md/.harnessComposable", "");
    await write(root, ".harness/dir/BAD.md/intro.md", "bad");
    await write(root, ".harness/dir/MIXED.md/.harnessComposable", "");
    await write(root, ".harness/dir/MIXED.md/100_intro.md", "bad");
    await write(root, ".harness/dir/MIXED.md/nested/100_intro.md", "bad");
    await write(root, ".harness/dir/MISSING.md/.harnessComposable", "");
    await write(root, ".harness/dir/MISSING.md/.ref", "../NOPE.md\n");
    await write(root, ".harness/dir/OUTSIDE.md/.harnessComposable", "");
    await write(root, ".harness/dir/OUTSIDE.md/.ref", "../../outside\n");
    await write(root, ".harness/dir/ABSOLUTE.md/.harnessComposable", "");
    await write(
      root,
      ".harness/dir/ABSOLUTE.md/.ref",
      `${path.join(root, ".harness/dir/AGENTS.md")}\n`
    );
    await write(root, ".harness/dir/A.md/.harnessComposable", "");
    await write(root, ".harness/dir/A.md/.ref", "../B.md\n");
    await write(root, ".harness/dir/B.md/.harnessComposable", "");
    await write(root, ".harness/dir/B.md/.ref", "../A.md\n");
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
