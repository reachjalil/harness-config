import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { runHarnessConfigCli } from "../src/index";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const examplesRoot = path.join(repoRoot, "examples");

const generatedPaths = [
  ".agents",
  ".claude",
  ".cursor",
  ".gemini",
  ".github",
  ".harness/local",
  "AGENTS.md",
  "CLAUDE.md",
];

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

async function exampleNames(): Promise<string[]> {
  const entries = await readdir(examplesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function copyExample(name: string): Promise<string> {
  const root = path.join(tmpdir(), `harness-example-${name}-${Date.now()}`);
  await cp(path.join(examplesRoot, name), root, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
  });
  await Promise.all(
    generatedPaths.map((relativePath) =>
      rm(path.join(root, relativePath), { force: true, recursive: true })
    )
  );
  return root;
}

async function run(root: string, args: string[]) {
  const capture = captureIo();
  const exitCode = await runHarnessConfigCli(
    [...args, "--root", root],
    capture.io
  );
  return {
    exitCode,
    output: [...capture.stdout, ...capture.stderr].join("\n"),
  };
}

describe("examples", () => {
  it("keeps every example valid and convergent", async () => {
    for (const name of await exampleNames()) {
      const root = await copyExample(name);

      const validate = await run(root, ["validate"]);
      expect(validate.exitCode, `${name} validate`).toBe(0);
      expect(validate.output, `${name} validate output`).toContain(
        "No Harness config issues found."
      );

      const dryRun = await run(root, ["activate"]);
      expect(dryRun.exitCode, `${name} activate dry run`).toBe(0);
      expect(dryRun.output, `${name} activate dry run output`).toContain(
        "activation dry run"
      );

      const apply = await run(root, ["activate", "--yes"]);
      expect(apply.exitCode, `${name} activate --yes`).toBe(0);

      const secondDryRun = await run(root, ["activate"]);
      expect(secondDryRun.exitCode, `${name} second activate dry run`).toBe(0);
      expect(
        secondDryRun.output.includes("keep") ||
          secondDryRun.output.includes("mutable"),
        `${name} should converge to keep or mutable actions`
      ).toBe(true);
    }
  });

  it("keeps the switchability examples honest", async () => {
    const profileExamples = [
      {
        name: "02-profile-mode-switching",
        profile: "security-audit",
        outputPath: ".agents/skills/security-audit/SKILL.md",
        expectedText: "# Security Audit",
      },
      {
        name: "03-team-kits",
        profile: "security-kit",
        outputPath: ".agents/skills/security-check/SKILL.md",
        expectedText: "# Security Check",
      },
    ];

    for (const example of profileExamples) {
      const root = await copyExample(example.name);
      await run(root, ["activate", "--yes"]);
      await writeFile(
        path.join(root, ".harnessProfile"),
        `${example.profile}\n`,
        "utf8"
      );

      const dryRun = await run(root, ["activate"]);
      expect(dryRun.exitCode, `${example.name} switched dry run`).toBe(0);
      expect(
        dryRun.output,
        `${example.name} switched dry run output`
      ).toContain("activation dry run");

      const apply = await run(root, ["activate", "--yes"]);
      expect(apply.exitCode, `${example.name} switched apply`).toBe(0);
      await expect(
        readFile(path.join(root, example.outputPath), "utf8")
      ).resolves.toContain(example.expectedText);
    }

    const localRoot = await copyExample("06-layered-local-overlays");
    await run(localRoot, ["activate", "--yes"]);
    await cp(
      path.join(localRoot, ".harness/local-template"),
      path.join(localRoot, ".harness/local"),
      { recursive: true }
    );
    await writeFile(
      path.join(localRoot, ".harness/local/.harnessProfileRoot"),
      "personal-lab\n",
      "utf8"
    );
    await writeFile(
      path.join(localRoot, ".harnessProfile"),
      "personal-lab\n",
      "utf8"
    );

    const localDryRun = await run(localRoot, ["activate"]);
    expect(localDryRun.exitCode, "06-layered-local-overlays dry run").toBe(0);
    expect(localDryRun.output).toContain("activation dry run");

    const localApply = await run(localRoot, ["activate", "--yes"]);
    expect(localApply.exitCode, "06-layered-local-overlays apply").toBe(0);
    await expect(
      readFile(
        path.join(localRoot, ".agents/skills/repo-review/SKILL.md"),
        "utf8"
      )
    ).resolves.toContain("my local review preferences");
    await expect(
      readFile(path.join(localRoot, "AGENTS.md"), "utf8")
    ).resolves.toContain("Personal lab mode is active.");
  });
});
