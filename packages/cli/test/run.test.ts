import { lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { runHarnessConfigCli } from "../src/index";

async function rootFixture(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "harnessc-"));
}

async function write(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function writeConfig(root: string, targets = ["./.agents"]) {
  await write(
    root,
    ".harness/harness.toml",
    [
      "version = 1",
      "",
      ...targets.flatMap((target) => ["[[targets]]", `path = "${target}"`, ""]),
    ].join("\n")
  );
}

async function writeDirConfig(root: string, dirPath = "./.harness/dir") {
  await write(
    root,
    ".harness/harness.toml",
    ["version = 1", "", "[dir]", `path = "${dirPath}"`, ""].join("\n")
  );
}

function captureIo(options: { supportsColor?: boolean } = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      supportsColor: options.supportsColor,
      stdout: (message: string) => stdout.push(message),
      stderr: (message: string) => stderr.push(message),
    },
  };
}

describe("harnessc", () => {
  it("prints help", async () => {
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(["--help"], capture.io);

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("harnessc validate");
    expect(capture.stdout.join("\n")).toContain("harnessc activate");
    expect(capture.stdout.join("\n")).toContain("harnessc extension activate");
    expect(capture.stdout.join("\n")).toContain(".harnessIgnore");
  });

  it("validates a missing default manifest with warnings", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["validate", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("harness.config_missing");
    expect(capture.stdout.join("\n")).toContain(".harness/harness.toml");
  });

  it("discovers the repository root from a nested working directory", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "# projection boundary\n");
    const nestedRoot = path.join(root, "packages", "example");
    await mkdir(nestedRoot, { recursive: true });
    const originalCwd = process.cwd();
    process.chdir(nestedRoot);
    try {
      const capture = captureIo();
      const exitCode = await runHarnessConfigCli(["validate"], capture.io);

      expect(exitCode).toBe(0);
      expect(capture.stdout.join("\n")).toContain(
        "No Harness config diagnostics found."
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("colors human output only when the output sink supports color", async () => {
    const root = await rootFixture();
    const originalNoColor = process.env.NO_COLOR;
    const originalForceColor = process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    try {
      const plain = captureIo();
      const colored = captureIo({ supportsColor: true });
      const json = captureIo({ supportsColor: true });

      await runHarnessConfigCli(["validate", "--root", root], plain.io);
      await runHarnessConfigCli(["validate", "--root", root], colored.io);
      await runHarnessConfigCli(
        ["validate", "--root", root, "--json"],
        json.io
      );

      expect(plain.stdout.join("\n")).not.toContain("\u001b[");
      expect(colored.stdout.join("\n")).toContain("\u001b[");
      expect(json.stdout.join("\n")).not.toContain("\u001b[");

      process.env.NO_COLOR = "1";
      const suppressed = captureIo({ supportsColor: true });
      await runHarnessConfigCli(["validate", "--root", root], suppressed.io);
      expect(suppressed.stdout.join("\n")).not.toContain("\u001b[");

      process.env.FORCE_COLOR = "1";
      const forced = captureIo();
      await runHarnessConfigCli(["validate", "--root", root], forced.io);
      expect(forced.stdout.join("\n")).toContain("\u001b[");
    } finally {
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
      if (originalForceColor === undefined) {
        delete process.env.FORCE_COLOR;
      } else {
        process.env.FORCE_COLOR = originalForceColor;
      }
    }
  });

  it("dry-runs init by default", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["init", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("dry run");
    await expect(
      readFile(path.join(root, ".harnessIgnore"), "utf8")
    ).rejects.toThrow();
  });

  it("does not suggest undeclared target names during plan", async () => {
    const root = await rootFixture();
    await mkdir(path.join(root, ".agents", "skills"), { recursive: true });
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["plan", "--root", root],
      capture.io
    );
    const output = capture.stdout.join("\n");

    expect(exitCode).toBe(0);
    expect(output).not.toContain("Known runtime surfaces found");
    expect(output).not.toContain("./.agents");
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"), "utf8")
    ).rejects.toThrow();
  });

  it("creates greenfield .harness with init --yes", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["init", "--root", root, "--yes"],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("applied");
    await expect(
      readFile(path.join(root, ".harnessIgnore"), "utf8")
    ).resolves.toContain("projecting .harness resources");
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"), "utf8")
    ).resolves.not.toContain("[resources]");
  });

  it("initializes custom resource folders and explicit targets when requested", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      [
        "init",
        "--root",
        root,
        "--yes",
        "--resource",
        "prompts",
        "--target",
        "./runtime/agent",
      ],
      capture.io
    );

    expect(exitCode).toBe(0);
    const config = await readFile(
      path.join(root, ".harness", "harness.toml"),
      "utf8"
    );
    expect(config).not.toContain("[resources.prompts]");
    expect(config).not.toContain("[resources.skills]");
    expect(config).toContain('path = "./runtime/agent"');
    await expect(
      lstat(path.join(root, ".harness/resources/prompts"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness/resources/skills"))
    ).rejects.toThrow();
  });

  it("initializes and activates with explicit config and resources paths", async () => {
    const root = await rootFixture();
    const initCapture = captureIo();
    const initExitCode = await runHarnessConfigCli(
      [
        "init",
        "--root",
        root,
        "--config",
        "./config/harness.custom.toml",
        "--resources-path",
        "./agent-context/resources",
        "--target",
        "./.agents",
        "--yes",
      ],
      initCapture.io
    );

    expect(initExitCode).toBe(0);
    const rawConfig = await readFile(
      path.join(root, "config", "harness.custom.toml"),
      "utf8"
    );
    expect(rawConfig).toContain("[resources]");
    expect(rawConfig).toContain('path = "./agent-context/resources"');
    await expect(
      lstat(path.join(root, "agent-context/resources/skills"))
    ).resolves.toBeTruthy();
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"))
    ).rejects.toThrow();

    await write(
      root,
      "agent-context/resources/skills/review/SKILL.md",
      "custom"
    );
    const activateCapture = captureIo();
    const activateExitCode = await runHarnessConfigCli(
      [
        "activate",
        "--root",
        root,
        "--config",
        "./config/harness.custom.toml",
        "--yes",
      ],
      activateCapture.io
    );

    expect(activateExitCode).toBe(0);
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("custom");
  });

  it("dry-runs init by default", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["init", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("dry run");
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"), "utf8")
    ).rejects.toThrow();
  });

  it("shows an activation dry run without writing live targets", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("activation dry run");
    expect(capture.stdout.join("\n")).toContain("create");
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).rejects.toThrow();
  });

  it("activates the default .harness/resources tree when [resources] is omitted", async () => {
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
    await write(root, ".harness/resources/hooks.json", "shared");
    await write(root, ".harness/resources/.gemini/hooks.json", "gemini");

    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      capture.io
    );

    expect(exitCode).toBe(0);
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("base");
    await expect(
      readFile(path.join(root, ".agents/hooks.json"), "utf8")
    ).resolves.toBe("shared");
    await expect(
      readFile(path.join(root, ".gemini/hooks.json"), "utf8")
    ).resolves.toBe("gemini");
  });

  it("applies activation with --yes and reports keeps on the next dry run", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );
    const applyCapture = captureIo();
    const applyExitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      applyCapture.io
    );

    expect(applyExitCode).toBe(0);
    expect(applyCapture.stdout.join("\n")).toContain("activation result");
    expect(applyCapture.stdout.join("\n")).toContain("create");
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("review skill");

    const dryRunCapture = captureIo();
    const dryRunExitCode = await runHarnessConfigCli(
      ["activate", "--root", root],
      dryRunCapture.io
    );

    expect(dryRunExitCode).toBe(0);
    expect(dryRunCapture.stdout.join("\n")).toContain("activation dry run");
    expect(dryRunCapture.stdout.join("\n")).toContain("keep");
  });

  it("summarizes unmanaged target entries and keeps them by default", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );
    await write(root, ".agents/skills/manual/SKILL.md", "manual skill");
    await write(root, ".agents/skills/review/local.md", "local note");

    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root],
      capture.io
    );
    const output = capture.stdout.join("\n");

    expect(exitCode).toBe(0);
    expect(output).toContain("preserve unmanaged 2");
    expect(output).toContain("Unmanaged target entries kept");
    expect(output).toContain("skills/manual");
    expect(output).toContain("skills/review/local.md");

    const applyCapture = captureIo();
    const applyExitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      applyCapture.io
    );

    expect(applyExitCode).toBe(0);
    await expect(
      readFile(path.join(root, ".agents/skills/manual/SKILL.md"), "utf8")
    ).resolves.toBe("manual skill");
  });

  it("removes unmanaged target entries only with --remove-unmanaged", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );
    await write(root, ".agents/skills/manual/SKILL.md", "manual skill");

    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--remove-unmanaged"],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("remove 1");
    expect(capture.stdout.join("\n")).toContain("Removals");
    expect(capture.stdout.join("\n")).toContain("skills/manual");

    const applyCapture = captureIo();
    const applyExitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes", "--remove-unmanaged"],
      applyCapture.io
    );

    expect(applyExitCode).toBe(0);
    await expect(
      readFile(path.join(root, ".agents/skills/manual/SKILL.md"), "utf8")
    ).rejects.toThrow();
  });

  it("rejects conflicting unmanaged cleanup flags", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--keep-unmanaged", "--remove-unmanaged"],
      capture.io
    );

    expect(exitCode).toBe(1);
    expect(capture.stderr.join("\n")).toContain(
      "Use either --keep-unmanaged or --remove-unmanaged"
    );
  });

  it("returns validation errors for invalid activation TOML", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harness/harness.toml",
      `
version = 1

[[targets]]
path = "./.claude"
mode = "copy"
`
    );
    await write(root, ".harnessIgnore", "");
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(1);
    expect(capture.stdout.join("\n")).toContain("harness.config_invalid");
    expect(capture.stdout.join("\n")).toContain(
      "harness.activation_config_unavailable"
    );
  });

  it("reports target byte changes as updates and applies the source projection", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md",
      "review skill"
    );

    await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      captureIo().io
    );

    await writeFile(
      path.join(root, ".agents/skills/review/SKILL.md"),
      "target edit",
      "utf8"
    );

    const planCapture = captureIo();
    await runHarnessConfigCli(["activate", "--root", root], planCapture.io);
    const planOutput = planCapture.stdout.join("\n");
    expect(planOutput).toContain("update 1");
    expect(planOutput).toContain("Updates");

    const applyCapture = captureIo();
    await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      applyCapture.io
    );
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("review skill");
  });

  it("skips mutable files unless --force-mutable", async () => {
    const root = await rootFixture();
    await writeConfig(root);
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

    await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      captureIo().io
    );
    await writeFile(
      path.join(root, ".agents/skills/review/settings.local.json"),
      '{"allow":["bash"]}',
      "utf8"
    );

    const planCapture = captureIo();
    await runHarnessConfigCli(["activate", "--root", root], planCapture.io);
    const planOutput = planCapture.stdout.join("\n");
    expect(planOutput).toContain("mutable 1");
    expect(planOutput).toContain("Mutable target files");

    const applyCapture = captureIo();
    await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      applyCapture.io
    );
    expect(applyCapture.stdout.join("\n")).toContain("--force-mutable");
    await expect(
      readFile(
        path.join(root, ".agents/skills/review/settings.local.json"),
        "utf8"
      )
    ).resolves.toBe('{"allow":["bash"]}');

    const forceCapture = captureIo();
    await runHarnessConfigCli(
      ["activate", "--root", root, "--yes", "--force-mutable"],
      forceCapture.io
    );
    await expect(
      readFile(
        path.join(root, ".agents/skills/review/settings.local.json"),
        "utf8"
      )
    ).resolves.toBe('{"allow":[]}');
  });

  it("composes a [dir] leaf with .harnessComposable into a repo-root file", async () => {
    const root = await rootFixture();
    await writeDirConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A\n");
    await write(root, ".harness/dir/AGENTS.md/200_rules.md", "B\n");
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("Dir composition");
    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A\nB\n"
    );
  });

  it("copies individual files from [dir] when no marker is present", async () => {
    const root = await rootFixture();
    await writeDirConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/notes/README.md", "hello\n");
    await write(root, ".harness/dir/notes/nested/info.txt", "deep\n");
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      capture.io
    );

    expect(exitCode).toBe(0);
    await expect(
      readFile(path.join(root, "notes/README.md"), "utf8")
    ).resolves.toBe("hello\n");
    await expect(
      readFile(path.join(root, "notes/nested/info.txt"), "utf8")
    ).resolves.toBe("deep\n");
  });

  it("merges [dir] outputs that fall under a declared target into that target", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[[targets]]",
        'path = "./.claude"',
        "",
        "[dir]",
        'path = "./.harness/dir"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/.claude/settings.json", '{"theme":"dark"}');
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      capture.io
    );

    expect(exitCode).toBe(0);
    await expect(
      readFile(path.join(root, ".claude/settings.json"), "utf8")
    ).resolves.toBe('{"theme":"dark"}');

    const secondPlan = captureIo();
    await runHarnessConfigCli(["activate", "--root", root], secondPlan.io);
    expect(secondPlan.stdout.join("\n")).toContain("keep");
  });

  it("end-to-end: composable + copy + .harnessRef + mixed-target dir activation", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[[targets]]",
        'path = "./.claude"',
        "",
        "[dir]",
        'path = "./.harness/dir"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "# Intro\n\n");
    await write(root, ".harness/dir/AGENTS.md/300_rules.md", "## Rules\n");
    await write(root, ".harness/dir/CLAUDE.md/.harnessComposable", "");
    await write(root, ".harness/dir/CLAUDE.md/.harnessRef", "../AGENTS.md\n");
    await write(root, ".harness/dir/CLAUDE.md/250_claude.md", "Claude note\n");
    await write(root, ".harness/dir/.claude/settings.json", "{}");
    await write(root, ".harness/dir/.gitignore/.harnessComposable", "");
    await write(
      root,
      ".harness/dir/.gitignore/100_node.txt",
      "node_modules/\n"
    );

    const dryRun = captureIo();
    const dryRunExitCode = await runHarnessConfigCli(
      ["activate", "--root", root],
      dryRun.io
    );
    expect(dryRunExitCode).toBe(0);

    const apply = captureIo();
    const applyExitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      apply.io
    );

    expect(applyExitCode).toBe(0);
    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "# Intro\n\n## Rules\n"
    );
    await expect(readFile(path.join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "# Intro\n\nClaude note\n## Rules\n"
    );
    await expect(readFile(path.join(root, ".gitignore"), "utf8")).resolves.toBe(
      "node_modules/\n"
    );
    await expect(
      readFile(path.join(root, ".claude/settings.json"), "utf8")
    ).resolves.toBe("{}");
  });

  it("end-to-end: target-output .harnessIgnore filters resources and dir outputs", async () => {
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
        'path = "./.claude"',
        "",
        "[dir]",
        'path = "./resources"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");
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
    await write(root, ".agents/skills/deploy-plan/.harnessIgnore", "*.tmp\n");
    await write(root, ".agents/skills/deploy-plan/local.md", "local");
    await write(root, "resources/AGENTS.md/.harnessComposable", "");
    await write(root, "resources/AGENTS.md/.harnessIgnore", "200_skip.md\n");
    await write(root, "resources/AGENTS.md/100_intro.md", "A");
    await write(root, "resources/AGENTS.md/200_skip.md", "B");
    await write(root, ".agents/tools/.harnessIgnore", "*.tmp\n");
    await write(root, "resources/.agents/tools/drop.tmp", "drop");
    await write(root, "resources/.agents/tools/keep.txt", "keep");

    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes", "--remove-unmanaged"],
      capture.io
    );

    expect(exitCode).toBe(0);
    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "A"
    );
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
    await expect(
      readFile(path.join(root, ".agents/skills/deploy-plan/local.md"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/tools/drop.tmp"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".agents/tools/keep.txt"), "utf8")
    ).resolves.toBe("keep");
    await expect(
      readFile(path.join(root, ".agents/tools/.harnessIgnore"), "utf8")
    ).resolves.toBe("*.tmp\n");
  });

  it("end-to-end: resource composables honor target ignores and profile selectors", async () => {
    const root = await rootFixture();
    await writeConfig(root, ["./.agents", "./.claude"]);
    await write(root, ".harnessIgnore", "");
    await write(root, ".agents/skills/.harnessProfile", "deploy\n");
    await write(root, ".agents/skills/local.md", "local");
    await write(root, ".claude/skills/blocked/.harnessIgnore", "SKILL.md\n");
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md/.harnessComposable",
      ""
    );
    await write(
      root,
      ".harness/resources/skills/review/SKILL.md/100_base.md",
      "Base\n"
    );
    await write(
      root,
      ".harness/resources/skills/blocked/SKILL.md/.harnessComposable",
      ""
    );
    await write(
      root,
      ".harness/resources/skills/blocked/SKILL.md/100_base.md",
      "Blocked\n"
    );
    await write(
      root,
      ".harness/profiles/deploy/.harnessProfileRoot",
      "deploy\n"
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/skills/review/SKILL.md/.harnessComposable",
      ""
    );
    await write(
      root,
      ".harness/profiles/deploy/resources/skills/review/SKILL.md/100_profile.md",
      "Profile\n"
    );

    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes", "--remove-unmanaged"],
      capture.io
    );

    expect(exitCode).toBe(0);
    await expect(
      readFile(path.join(root, ".agents/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("Profile\n");
    await expect(
      readFile(path.join(root, ".claude/skills/review/SKILL.md"), "utf8")
    ).resolves.toBe("Base\n");
    await expect(
      readFile(path.join(root, ".agents/skills/blocked/SKILL.md"), "utf8")
    ).resolves.toBe("Blocked\n");
    await expect(
      readFile(path.join(root, ".claude/skills/blocked/SKILL.md"))
    ).rejects.toThrow();
    await expect(
      readFile(path.join(root, ".claude/skills/blocked/.harnessIgnore"), "utf8")
    ).resolves.toBe("SKILL.md\n");
    await expect(
      readFile(path.join(root, ".agents/skills/.harnessProfile"), "utf8")
    ).resolves.toBe("deploy\n");
    await expect(
      readFile(path.join(root, ".agents/skills/local.md"))
    ).rejects.toThrow();
  });

  it("end-to-end: profile roots overlay resources and composable dir outputs", async () => {
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
        "[dir]",
        'path = "./.harness/dir"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    await write(root, ".harnessProfile", "deploy-kit\n");
    await write(root, ".harness/resources/skills/base/SKILL.md", "base");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "Base\n");
    await write(root, ".harness/dir/AGENTS.md/300_rules.md", "Rules\n");
    await write(
      root,
      ".harness/kits/deploy-kit/.harnessProfileRoot",
      "deploy-kit\n"
    );
    await write(
      root,
      ".harness/kits/deploy-kit/.harnessIgnore",
      "skills/base/\n"
    );
    await write(
      root,
      ".harness/kits/deploy-kit/resources/skills/deploy-plan/SKILL.md",
      "deploy"
    );
    await write(
      root,
      ".harness/kits/deploy-kit/dir/AGENTS.md/.harnessIgnore",
      "100_intro.md\n"
    );
    await write(
      root,
      ".harness/kits/deploy-kit/dir/AGENTS.md/100_deploy.md",
      "Deploy\n"
    );

    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root, "--yes"],
      capture.io
    );

    expect(exitCode).toBe(0);
    await expect(
      readFile(path.join(root, ".agents/skills/deploy-plan/SKILL.md"), "utf8")
    ).resolves.toBe("deploy");
    await expect(
      readFile(path.join(root, ".agents/skills/base/SKILL.md"))
    ).rejects.toThrow();
    await expect(readFile(path.join(root, "AGENTS.md"), "utf8")).resolves.toBe(
      "Deploy\nRules\n"
    );
    await expect(
      readFile(path.join(root, ".agents/kits/deploy-kit/.harnessProfileRoot"))
    ).rejects.toThrow();
  });

  it("reports a path-conflict when a copy file collides with a composable leaf", async () => {
    const root = await rootFixture();
    await writeDirConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/dir/AGENTS.md/.harnessComposable", "");
    await write(root, ".harness/dir/AGENTS.md/100_intro.md", "A");
    await write(root, ".harness/dir/AGENTS.md/nested/oops.txt", "nope");

    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["activate", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(1);
    expect(capture.stdout.join("\n")).toContain("harness.dir_mixed_container");
  });

  it("reports extension activation selection errors", async () => {
    const root = await rootFixture();
    await write(
      root,
      ".harness/harness.toml",
      [
        "version = 1",
        "",
        "[extensions.fake]",
        "version = 1",
        'activation = "auto"',
        "",
      ].join("\n")
    );
    await write(root, ".harnessIgnore", "");
    const unsupported = captureIo();
    const unsupportedExitCode = await runHarnessConfigCli(
      ["extension", "activate", "--root", root, "--all"],
      unsupported.io
    );

    expect(unsupportedExitCode).toBe(1);
    expect(unsupported.stdout.join("\n")).toContain("not supported");
  });

  it("rejects conflicting extension selection flags", async () => {
    const root = await rootFixture();
    await write(root, ".harness/harness.toml", "version = 1\n");
    await write(root, ".harnessIgnore", "");
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["extension", "activate", "--root", root, "--all", "--extension", "any"],
      capture.io
    );

    expect(exitCode).toBe(1);
    expect(capture.stdout.join("\n")).toContain(
      "Use either --all or --extension"
    );
  });
});
