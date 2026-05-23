import { lstat, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  applyHarnessTransition,
  planHarnessTransition,
  validateHarnessConfig,
} from "../src/index";

async function fixtureRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "harnessconfig-transition-"));
}

describe("HarnessConfig transition", () => {
  it("plans greenfield .harness initialization without touching .agents", async () => {
    const root = await fixtureRoot();
    await mkdir(path.join(root, ".agents", "skills"), { recursive: true });

    const plan = await planHarnessTransition(root);

    expect(
      plan.actions.some((action) => action.id === "harness.root.ensure")
    ).toBe(true);
    expect(
      plan.actions.some(
        (action) => action.id === "surface.agents.skills.review"
      )
    ).toBe(true);
  });

  it("dry-runs a transition by default", async () => {
    const root = await fixtureRoot();

    const result = await applyHarnessTransition(root);

    expect(result.dryRun).toBe(true);
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"), "utf8")
    ).rejects.toThrow();
  });

  it("applies a transition to .harness with explicit confirmation", async () => {
    const root = await fixtureRoot();

    await applyHarnessTransition(root, { yes: true });
    const rawConfig = await readFile(
      path.join(root, ".harness", "harness.toml"),
      "utf8"
    );
    const rawIgnore = await readFile(path.join(root, ".harnessIgnore"), "utf8");
    const validation = await validateHarnessConfig(root);

    expect(rawConfig).toContain("version = 1");
    expect(rawIgnore).toContain("projecting .harness resources");
    expect(validation.hasHarnessDir).toBe(true);
    expect(validation.hasHarnessIgnore).toBe(true);
  });

  it("creates only the standard resource folders for fresh init", async () => {
    const root = await fixtureRoot();

    await applyHarnessTransition(root, { yes: true });

    await expect(
      lstat(path.join(root, ".harness", "skills"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "rules"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "plugins"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "reports"))
    ).rejects.toThrow();
  });

  it("reports a missing projection ignore file after partial setup", async () => {
    const root = await fixtureRoot();
    await mkdir(path.join(root, ".harness"), { recursive: true });

    const validation = await validateHarnessConfig(root);

    expect(validation.hasHarnessIgnore).toBe(false);
    expect(
      validation.diagnostics.map((diagnostic) => diagnostic.code)
    ).toContain("harness.ignore_missing");
  });
});
