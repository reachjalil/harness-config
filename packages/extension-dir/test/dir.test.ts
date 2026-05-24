import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyDirExtension, planDirExtension } from "../src/index";

async function fixtureRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "harness-dir-"));
}

async function write(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function writeConfig(root: string, targets: string[] = []) {
  await write(
    root,
    ".harness/harness.toml",
    [
      "version = 1",
      "",
      ...targets.flatMap((target) => ["[[targets]]", `path = "${target}"`, ""]),
      "[extensions.dir]",
      "version = 1",
      'activation = "explicit"',
      'path = "./.harness/dir"',
      "",
    ].join("\n")
  );
}

describe("dir extension", () => {
  it("composes top-level, nested, dot-directory, and extensionless outputs", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A\n");
    await write(root, ".harness/dir/AGENTS.md/200_rules.txt", "B\n");
    await write(
      root,
      ".harness/dir/.github/copilot-instructions.md/100_intro.md",
      "C\n"
    );
    await write(root, ".harness/dir/PROMPT/100_context", "P\n");

    const result = await applyDirExtension(root, { yes: true });

    expect(result.appliedActions.map((action) => action.kind)).toEqual([
      "create",
      "create",
      "create",
    ]);
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
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/AGENTS.md/300_rules.md", "C");
    await write(root, ".harness/dir/CLAUDE.md/.ref", "../AGENTS.md\n");
    await write(root, ".harness/dir/CLAUDE.md/250_claude_note.md", "B");

    await applyDirExtension(root, { yes: true });

    await expect(readFile(path.join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "ABC"
    );
  });

  it("keeps duplicate numbers additive with imported parts before local parts", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/100_same.md", "A");
    await write(root, ".harness/dir/CLAUDE.md/.ref", "../AGENTS.md\n");
    await write(root, ".harness/dir/CLAUDE.md/100_same.md", "B");

    await applyDirExtension(root, { yes: true });

    await expect(readFile(path.join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "AB"
    );
  });

  it("honors only global .harnessIgnore rules", async () => {
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
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/AGENTS.md/200_skip.md", "B");
    await write(root, ".harness/dir/IGNORED.md/100_intro.md", "ignored");

    await applyDirExtension(root, { yes: true });

    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
    await expect(
      readFile(path.join(root, "IGNORED.md"), "utf8")
    ).rejects.toThrow();
  });

  it("reports invalid parts, mixed containers, symlinks, missing refs, outside refs, and cycles", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/BAD.md/intro.md", "bad");
    await write(root, ".harness/dir/MIXED.md/100_intro.md", "bad");
    await write(root, ".harness/dir/MIXED.md/nested/100_intro.md", "bad");
    await write(root, ".harness/dir/MISSING.md/.ref", "../NOPE.md\n");
    await write(root, ".harness/dir/OUTSIDE.md/.ref", "../../outside\n");
    await write(
      root,
      ".harness/dir/ABSOLUTE.md/.ref",
      `${path.join(root, ".harness/dir/AGENTS.md")}\n`
    );
    await write(root, ".harness/dir/A.md/.ref", "../B.md\n");
    await write(root, ".harness/dir/B.md/.ref", "../A.md\n");
    await symlink(
      path.join(root, ".harness/dir/BAD.md/intro.md"),
      path.join(root, ".harness/dir/BAD.md/200_link.md")
    );

    const plan = await planDirExtension(root);
    const codes = plan.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain("harness.dir_invalid_part");
    expect(codes).toContain("harness.dir_mixed_container");
    expect(codes).toContain("harness.dir_invalid_entry");
    expect(codes).toContain("harness.dir_ref_missing");
    expect(codes).toContain("harness.dir_ref_absolute");
    expect(codes).toContain("harness.dir_ref_outside_root");
    expect(codes).toContain("harness.dir_ref_cycle");
  });

  it("reports create, update, and keep for managed outputs", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");

    const createPlan = await planDirExtension(root);
    expect(createPlan.actions[0]?.kind).toBe("create");

    await applyDirExtension(root, { yes: true });
    const keepPlan = await planDirExtension(root);
    expect(keepPlan.actions[0]?.kind).toBe("keep");

    await write(root, "AGENTS.md", "local edit");
    const updatePlan = await planDirExtension(root);
    expect(updatePlan.actions[0]?.kind).toBe("update");

    await applyDirExtension(root, { yes: true });
    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
  });

  it("creates empty leaf outputs and replaces existing non-file destinations", async () => {
    const root = await fixtureRoot();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await mkdir(path.join(root, ".harness/dir/EMPTY"), { recursive: true });
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/LINKED.md/100_intro.md", "L");
    await mkdir(path.join(root, "AGENTS.md/nested"), { recursive: true });
    await write(root, "manual.txt", "manual");
    await symlink(path.join(root, "manual.txt"), path.join(root, "LINKED.md"));

    const plan = await planDirExtension(root);

    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "create",
          relativePath: "EMPTY",
        }),
        expect.objectContaining({
          kind: "update",
          reason: "replace existing directory with composed file",
          relativePath: "AGENTS.md",
        }),
        expect.objectContaining({
          kind: "update",
          reason: "replace existing symlink with composed file",
          relativePath: "LINKED.md",
        }),
      ])
    );

    await applyDirExtension(root, { yes: true });

    await expect(readFile(path.join(root, "EMPTY"), "utf8")).resolves.toBe("");
    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
    await expect(readFile(path.join(root, "LINKED.md"), "utf8")).resolves.toBe(
      "L"
    );
  });

  it("rejects outputs that overlap .harness or declared targets", async () => {
    const root = await fixtureRoot();
    await writeConfig(root, ["./.agents"]);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/.harness/generated.md/100_intro.md", "bad");
    await write(root, ".harness/dir/.agents/AGENTS.md/100_intro.md", "bad");

    const plan = await planDirExtension(root);
    const codes = plan.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain("harness.dir_output_inside_harness");
    expect(codes).toContain("harness.dir_output_target_overlap");
  });
});
