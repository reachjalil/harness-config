import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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

const documentedExamples = [
  "01-multi-runtime-one-source",
  "02-profile-mode-switching",
  "03-team-kits",
  "04-composable-instructions",
  "05-runtime-owned-state",
  "06-layered-local-overlays",
  "07-worktree-fleet-wildcards",
  "08-monorepo-package-wildcards",
  "09-isolated-profile-packs",
];

const generatedPaths = [
  ".agents",
  ".claude",
  ".cursor",
  ".gemini",
  ".github",
  ".harness/local",
  "AGENTS.md",
  "CLAUDE.md",
  "PROJECT_GUIDE.md",
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
    .filter((entry) => /^\d{2}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function exampleLinksFrom(relativePath: string): Promise<string[]> {
  const text = await readFile(path.join(repoRoot, relativePath), "utf8");
  return [
    ...new Set(
      [
        ...text.matchAll(
          /\]\((?:\.\/)?(?:examples\/)?(\d{2}-[^/)]+)\/README\.md\)/g
        ),
      ]
        .map((match) => match[1])
        .filter((value): value is string => Boolean(value))
    ),
  ].sort();
}

async function copyExample(name: string): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), `harness-${name}-`));
  const root = path.join(workspace, "repo");
  await cp(path.join(examplesRoot, name), root, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
  });
  await Promise.all(
    generatedPaths.map((relativePath) =>
      rm(path.join(root, relativePath), { force: true, recursive: true })
    )
  );
  await prepareCopiedExample(name, root);
  return root;
}

async function prepareCopiedExample(name: string, root: string) {
  if (name !== "07-worktree-fleet-wildcards") {
    return;
  }

  await Promise.all(
    ["feature-login", "release-hardening"].map((worktree) =>
      mkdir(path.join(root, "../worktrees", worktree), { recursive: true })
    )
  );
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

async function expectFileContains(
  filePath: string,
  expectedText: string,
  label = filePath
) {
  await expect(readFile(filePath, "utf8"), label).resolves.toContain(
    expectedText
  );
}

async function expectRepoFileContains(
  root: string,
  relativePath: string,
  expectedText: string
) {
  await expectFileContains(
    path.join(root, relativePath),
    expectedText,
    relativePath
  );
}

async function expectRepoFileMissing(root: string, relativePath: string) {
  await expect(
    readFile(path.join(root, relativePath), "utf8"),
    `${relativePath} should not exist`
  ).rejects.toMatchObject({ code: "ENOENT" });
}

async function assertExampleOutputs(name: string, root: string) {
  switch (name) {
    case "01-multi-runtime-one-source":
      await expectRepoFileContains(
        root,
        ".agents/skills/code-review/SKILL.md",
        "# Code Review"
      );
      await expectRepoFileContains(
        root,
        ".claude/skills/code-review/SKILL.md",
        "# Claude Code Review"
      );
      await expectRepoFileContains(
        root,
        ".gemini/skills/code-review/SKILL.md",
        "# Gemini Code Review"
      );
      await expectRepoFileContains(
        root,
        ".cursor/rules/harness-config.mdc",
        "Shared Harness config workflow"
      );
      await expectRepoFileContains(root, ".agents/hooks.json", "shared");
      await expectRepoFileContains(root, ".claude/hooks.json", "claude");
      await expectRepoFileMissing(
        root,
        ".agents/skills/code-review/scratch/notes.md"
      );
      return;

    case "02-profile-mode-switching":
      await expectRepoFileContains(
        root,
        ".agents/skills/project-context/SKILL.md",
        "# Project Context"
      );
      await expectRepoFileContains(
        root,
        ".agents/skills/frontend-ui/SKILL.md",
        "# Frontend UI"
      );
      await expectRepoFileContains(
        root,
        ".agents/prompts/mode.md",
        "Frontend mode"
      );
      await expectRepoFileContains(
        root,
        "AGENTS.md",
        "Frontend mode focuses on components"
      );
      await expectRepoFileContains(root, "CLAUDE.md", "## Claude Notes");
      await expectRepoFileMissing(
        root,
        ".agents/skills/security-audit/SKILL.md"
      );
      return;

    case "03-team-kits":
      await expectRepoFileContains(
        root,
        ".agents/skills/repo-basics/SKILL.md",
        "# Repo Basics"
      );
      await expectRepoFileContains(
        root,
        ".agents/skills/deploy-check/SKILL.md",
        "# Deploy Check"
      );
      await expectRepoFileContains(
        root,
        ".agents/prompts/kit.md",
        "Deploy kit"
      );
      await expectRepoFileContains(root, "AGENTS.md", "Deploy kit is active");
      await expectRepoFileMissing(
        root,
        ".agents/skills/security-check/SKILL.md"
      );
      return;

    case "04-composable-instructions":
      await expectRepoFileContains(root, "AGENTS.md", "# Agent Guide");
      await expectRepoFileContains(root, "AGENTS.md", "## Workflow");
      await expectRepoFileContains(root, "CLAUDE.md", "## Claude Extras");
      await expectRepoFileContains(
        root,
        ".github/copilot-instructions.md",
        "## Copilot Extras"
      );
      await expectRepoFileContains(
        root,
        ".github/copilot-instructions.md",
        "Use the repository source of truth"
      );
      return;

    case "05-runtime-owned-state":
      await expectRepoFileContains(
        root,
        ".agents/skills/runtime-state/SKILL.md",
        "# Runtime State"
      );
      await expectRepoFileContains(
        root,
        ".agents/settings.local.json",
        '"allowedCommands": []'
      );
      await expectRepoFileContains(
        root,
        ".claude/settings.local.json",
        '"allowedCommands": ["pnpm test"]'
      );
      return;

    case "06-layered-local-overlays":
      await expectRepoFileContains(
        root,
        ".agents/skills/repo-review/SKILL.md",
        "shared team rules"
      );
      await expectRepoFileContains(
        root,
        "AGENTS.md",
        "Use the shared team configuration"
      );
      return;

    case "07-worktree-fleet-wildcards": {
      const workspace = path.dirname(root);
      for (const worktree of ["feature-login", "release-hardening"]) {
        const targetRoot = path.join(
          workspace,
          "worktrees",
          worktree,
          ".codex"
        );
        await expectFileContains(
          path.join(targetRoot, "skills/review/SKILL.md"),
          "# Shared Review",
          `${worktree} shared review skill`
        );
        await expectFileContains(
          path.join(targetRoot, "skills/feature-flag/SKILL.md"),
          "# Feature Flag",
          `${worktree} feature flag skill`
        );
        await expectFileContains(
          path.join(targetRoot, "skills/release-check/SKILL.md"),
          "# Release Check",
          `${worktree} release check skill`
        );
        await expectFileContains(
          path.join(targetRoot, "BRANCH_GUIDE.md"),
          "Release branches should call out version changes",
          `${worktree} branch guide`
        );
        await expectFileContains(
          path.join(targetRoot, "settings.json"),
          "worktree-fleet",
          `${worktree} target override`
        );
      }
      return;
    }

    case "08-monorepo-package-wildcards":
      await expectRepoFileContains(
        root,
        ".agents/skills/api-contract/SKILL.md",
        "# API Contract"
      );
      await expectRepoFileContains(
        root,
        ".agents/skills/web-ui/SKILL.md",
        "# Web UI"
      );
      await expectRepoFileContains(
        root,
        ".agents/prompts/docs-style.md",
        "# Docs Style Prompt"
      );
      await expectRepoFileContains(
        root,
        ".claude/hooks.json",
        "web package claude hook"
      );
      await expectRepoFileContains(root, "AGENTS.md", "# API Package");
      await expectRepoFileContains(root, "AGENTS.md", "# Docs Package");
      await expectRepoFileContains(root, "AGENTS.md", "# Web Package");
      return;

    case "09-isolated-profile-packs":
      await expectRepoFileContains(
        root,
        ".agents/skills/frontend/SKILL.md",
        "# Frontend Pack"
      );
      await expectRepoFileContains(
        root,
        ".agents/skills/local-frontend/SKILL.md",
        "# Local Frontend Override"
      );
      await expectRepoFileMissing(root, ".agents/skills/baseline/SKILL.md");
      await expectRepoFileMissing(root, ".agents/skills/backend/SKILL.md");
      await expectRepoFileContains(
        root,
        ".agents/prompts/shared.md",
        "# Shared Prompt"
      );
      await expectRepoFileContains(root, "AGENTS.md", "Frontend pack guide");
      await expectRepoFileContains(
        root,
        "AGENTS.md",
        "Local frontend override guide"
      );
      await expect(
        readFile(path.join(root, "AGENTS.md"), "utf8")
      ).resolves.not.toContain("Base Agent Guide");
      await expectRepoFileContains(
        root,
        "PROJECT_GUIDE.md",
        "This unrelated dir output stays active"
      );
      return;

    default:
      throw new Error(`Missing output assertions for example ${name}.`);
  }
}

describe("examples", () => {
  it("keeps example directories and indexes aligned", async () => {
    expect(await exampleNames()).toEqual(documentedExamples);
    expect(await exampleLinksFrom("README.md")).toEqual(documentedExamples);
    expect(await exampleLinksFrom("examples/README.md")).toEqual(
      documentedExamples
    );
  });

  it("keeps example-local generated output ignores anchored", async () => {
    for (const name of documentedExamples) {
      const ignorePath = path.join(examplesRoot, name, ".gitignore");
      const text = await readFile(ignorePath, "utf8");
      for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
          continue;
        }
        expect(
          line,
          `${name}/.gitignore line ${index + 1} should be example-root scoped`
        ).toMatch(/^!?\//);
      }
    }
  });

  it("keeps every example valid and convergent", async () => {
    for (const name of documentedExamples) {
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

      await assertExampleOutputs(name, root);

      const secondDryRun = await run(root, ["activate"]);
      expect(secondDryRun.exitCode, `${name} second activate dry run`).toBe(0);
      expect(
        secondDryRun.output.includes("keep") ||
          secondDryRun.output.includes("mutable"),
        `${name} should converge to keep or mutable actions`
      ).toBe(true);
    }
  }, 20_000);

  it("keeps mutable example runtime ownership honest", async () => {
    const root = await copyExample("05-runtime-owned-state");
    const apply = await run(root, ["activate", "--yes"]);
    expect(apply.exitCode).toBe(0);

    await writeFile(
      path.join(root, ".agents/settings.local.json"),
      '{"createdBy":"runtime","allowedCommands":["pnpm test"]}\n',
      "utf8"
    );

    const dryRun = await run(root, ["activate"]);
    expect(dryRun.exitCode).toBe(0);
    expect(dryRun.output).toContain("mutable");

    const preserve = await run(root, ["activate", "--yes"]);
    expect(preserve.exitCode).toBe(0);
    await expectRepoFileContains(
      root,
      ".agents/settings.local.json",
      '"createdBy":"runtime"'
    );

    const force = await run(root, ["activate", "--yes", "--force-mutable"]);
    expect(force.exitCode).toBe(0);
    await expectRepoFileContains(
      root,
      ".agents/settings.local.json",
      '"createdBy": "harness"'
    );
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

  it("demonstrates wildcard target parent fanout to sibling worktrees", async () => {
    const root = await copyExample("07-worktree-fleet-wildcards");
    const workspace = path.dirname(root);
    const apply = await run(root, ["activate", "--yes"]);
    expect(apply.exitCode).toBe(0);

    await assertExampleOutputs("07-worktree-fleet-wildcards", root);

    const explain = await run(root, [
      "explain",
      path.join(workspace, "worktrees/feature-login/.codex/BRANCH_GUIDE.md"),
      "--json",
    ]);
    expect(explain.exitCode).toBe(0);
    expect(explain.output).toContain("../worktrees/feature-login");
  });

  it("demonstrates wildcard package source roots in a monorepo", async () => {
    const root = await copyExample("08-monorepo-package-wildcards");
    const apply = await run(root, ["activate", "--yes"]);
    expect(apply.exitCode).toBe(0);

    await assertExampleOutputs("08-monorepo-package-wildcards", root);

    const explain = await run(root, [
      "explain",
      ".claude/hooks.json",
      "--json",
    ]);
    expect(explain.exitCode).toBe(0);
    expect(explain.output).toContain("packages/web/.harness/resources");
  });

  it("demonstrates isolated wildcard profile packs", async () => {
    const root = await copyExample("09-isolated-profile-packs");
    const apply = await run(root, ["activate", "--yes"]);
    expect(apply.exitCode).toBe(0);

    await assertExampleOutputs("09-isolated-profile-packs", root);

    const frontendExplain = await run(root, [
      "explain",
      ".agents/skills/frontend/SKILL.md",
      "--json",
    ]);
    expect(frontendExplain.exitCode).toBe(0);
    expect(frontendExplain.output).toContain(
      ".harness/packs/frontend/resources"
    );

    const sharedExplain = await run(root, [
      "explain",
      ".agents/prompts/shared.md",
      "--json",
    ]);
    expect(sharedExplain.exitCode).toBe(0);
    expect(sharedExplain.output).toContain(".harness/resources");

    await writeFile(path.join(root, ".harnessProfile"), "backend\n", "utf8");
    const backendApply = await run(root, [
      "activate",
      "--yes",
      "--remove-orphans",
    ]);
    expect(backendApply.exitCode).toBe(0);
    await expectRepoFileContains(
      root,
      ".agents/skills/backend/SKILL.md",
      "# Backend Pack"
    );
    await expectRepoFileMissing(root, ".agents/skills/frontend/SKILL.md");
    await expectRepoFileMissing(root, ".agents/skills/local-frontend/SKILL.md");
    await expectRepoFileMissing(root, ".agents/skills/baseline/SKILL.md");
    await expectRepoFileContains(
      root,
      "AGENTS.md",
      "Backend pack guide is active"
    );
    await expect(
      readFile(path.join(root, "AGENTS.md"), "utf8")
    ).resolves.not.toContain("Frontend pack guide");
    await expectRepoFileContains(
      root,
      "PROJECT_GUIDE.md",
      "This unrelated dir output stays active"
    );

    const backendExplain = await run(root, [
      "explain",
      ".agents/skills/backend/SKILL.md",
      "--json",
    ]);
    expect(backendExplain.exitCode).toBe(0);
    expect(backendExplain.output).toContain(".harness/packs/backend/resources");
  });
});
