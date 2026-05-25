import { lstat, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  applyHarnessInitialization,
  planHarnessInitialization,
  validateHarnessConfig,
} from "../src/index";

async function fixtureRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "harnessconfig-init-"));
}

describe("HarnessConfig initialization", () => {
  it("plans greenfield .harness initialization without treating existing folders as implicit targets", async () => {
    const root = await fixtureRoot();
    await mkdir(path.join(root, "runtime", "skills"), { recursive: true });

    const plan = await planHarnessInitialization(root);

    expect(
      plan.actions.some((action) => action.id === "harness.root.ensure")
    ).toBe(true);
    expect(plan.actions.some((action) => action.id.includes("runtime"))).toBe(
      false
    );
  });

  it("dry-runs initialization by default", async () => {
    const root = await fixtureRoot();

    const result = await applyHarnessInitialization(root);

    expect(result.dryRun).toBe(true);
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"), "utf8")
    ).rejects.toThrow();
  });

  it("applies initialization to .harness with explicit confirmation", async () => {
    const root = await fixtureRoot();

    await applyHarnessInitialization(root, { yes: true });
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

  it("creates only the conventional resource folders for fresh init", async () => {
    const root = await fixtureRoot();

    await applyHarnessInitialization(root, { yes: true });

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

  it("can initialize custom resource roots and explicit targets", async () => {
    const root = await fixtureRoot();

    await applyHarnessInitialization(root, {
      yes: true,
      config: {
        version: 1,
        standard: { name: "harness-config" },
        resources: {
          prompts: { path: "./.harness/prompts" },
          workflows: { path: "./.harness/workflows" },
        },
        targets: [{ path: "./runtime/agent" }, { path: "./custom-target" }],
      },
    });

    const rawConfig = await readFile(
      path.join(root, ".harness", "harness.toml"),
      "utf8"
    );

    expect(rawConfig).toContain("[resources.prompts]");
    expect(rawConfig).toContain('path = "./runtime/agent"');
    expect(rawConfig).toContain('path = "./custom-target"');
    await expect(
      lstat(path.join(root, ".harness", "prompts"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "workflows"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "skills"))
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
