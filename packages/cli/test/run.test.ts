import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
      "[resources.skills]",
      'path = "./.harness/skills"',
      "",
      ...targets.flatMap((target) => ["[[targets]]", `path = "${target}"`, ""]),
    ].join("\n")
  );
}

function captureIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
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
    expect(capture.stdout.join("\n")).toContain(".harnessIgnore");
  });

  it("validates a missing .harness root with warnings", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["validate", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("harness.root_missing");
  });

  it("dry-runs transition by default", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["transition", "--root", root],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("dry run");
    await expect(
      readFile(path.join(root, ".harnessIgnore"), "utf8")
    ).rejects.toThrow();
  });

  it("shows known runtime surfaces as advisory plan hints", async () => {
    const root = await rootFixture();
    await mkdir(path.join(root, ".agents", "skills"), { recursive: true });
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["plan", "--root", root],
      capture.io
    );
    const output = capture.stdout.join("\n");

    expect(exitCode).toBe(0);
    expect(output).toContain("Known runtime surfaces found");
    expect(output).toContain('declare [[targets]] path = "./.agents"');
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"), "utf8")
    ).rejects.toThrow();
  });

  it("creates greenfield .harness with transition --yes", async () => {
    const root = await rootFixture();
    const capture = captureIo();
    const exitCode = await runHarnessConfigCli(
      ["transition", "--root", root, "--yes"],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("applied");
    await expect(
      readFile(path.join(root, ".harnessIgnore"), "utf8")
    ).resolves.toContain("projecting .harness resources");
  });

  it("initializes custom resources and explicit targets when requested", async () => {
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
        "./.agents",
      ],
      capture.io
    );

    expect(exitCode).toBe(0);
    const config = await readFile(
      path.join(root, ".harness/harness.toml"),
      "utf8"
    );
    expect(config).toContain("[resources.prompts]");
    expect(config).not.toContain("[resources.skills]");
    expect(config).toContain('path = "./.agents"');
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
      readFile(path.join(root, ".harness/harness.toml"), "utf8")
    ).rejects.toThrow();
  });

  it("shows an activation dry run without writing live targets", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "review skill");
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

  it("applies activation with --yes and reports keeps on the next dry run", async () => {
    const root = await rootFixture();
    await writeConfig(root);
    await write(root, ".harnessIgnore", "");
    await write(root, ".harness/skills/review/SKILL.md", "review skill");
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
    await write(root, ".harness/skills/review/SKILL.md", "review skill");
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
    await write(root, ".harness/skills/review/SKILL.md", "review skill");
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
});
