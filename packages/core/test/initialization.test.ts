import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
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
  it("plans greenfield initialization without treating existing folders as implicit targets", async () => {
    const root = await fixtureRoot();
    await mkdir(path.join(root, "runtime", "skills"), { recursive: true });

    const plan = await planHarnessInitialization(root);

    expect(
      plan.actions.some(
        (action) => action.id === "harness.resource.skills.ensure"
      )
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

  it("applies initialization with explicit confirmation", async () => {
    const root = await fixtureRoot();

    await applyHarnessInitialization(root, { yes: true });
    const rawConfig = await readFile(
      path.join(root, ".harness", "harness.toml"),
      "utf8"
    );
    const rawIgnore = await readFile(path.join(root, ".harnessIgnore"), "utf8");
    const validation = await validateHarnessConfig(root);

    expect(rawConfig).toContain("version = 1");
    expect(rawConfig).not.toContain("[resources]");
    expect(rawIgnore).toContain("projecting .harness resources");
    expect(validation.hasHarnessDir).toBe(true);
    expect(validation.hasHarnessIgnore).toBe(true);
  });

  it("creates only the conventional resource folders for fresh init", async () => {
    const root = await fixtureRoot();

    await applyHarnessInitialization(root, { yes: true });

    await expect(
      lstat(path.join(root, ".harness", "resources", "skills"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "resources", "rules"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "resources", "plugins"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "resources", "reports"))
    ).rejects.toThrow();
  });

  it("can initialize custom resource folders and explicit targets", async () => {
    const root = await fixtureRoot();

    await applyHarnessInitialization(root, {
      yes: true,
      resourceKinds: ["prompts", "workflows"],
      config: {
        version: 1,
        standard: { name: "harness-config" },
        targets: [{ path: "./runtime/agent" }, { path: "./custom-target" }],
      },
    });

    const rawConfig = await readFile(
      path.join(root, ".harness", "harness.toml"),
      "utf8"
    );

    expect(rawConfig).not.toContain("[resources.prompts]");
    expect(rawConfig).toContain('path = "./runtime/agent"');
    expect(rawConfig).toContain('path = "./custom-target"');
    await expect(
      lstat(path.join(root, ".harness", "resources", "prompts"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "resources", "workflows"))
    ).resolves.toBeTruthy();
    await expect(
      lstat(path.join(root, ".harness", "resources", "skills"))
    ).rejects.toThrow();
  });

  it("can initialize an explicit config path and resources source path", async () => {
    const root = await fixtureRoot();

    await applyHarnessInitialization(root, {
      yes: true,
      configPath: "./config/harness.custom.toml",
      resourcesPath: "./agent-context/resources",
      resourceKinds: ["skills"],
    });

    const rawConfig = await readFile(
      path.join(root, "config", "harness.custom.toml"),
      "utf8"
    );

    expect(rawConfig).toContain("[resources]");
    expect(rawConfig).toContain('path = "./agent-context/resources"');
    await expect(
      lstat(path.join(root, "agent-context", "resources", "skills"))
    ).resolves.toBeTruthy();
    await expect(
      readFile(path.join(root, ".harness", "harness.toml"))
    ).rejects.toThrow();
  });

  it("explains that init does not adopt existing target entries", async () => {
    const root = await fixtureRoot();
    await mkdir(path.join(root, ".agents", "skills", "manual"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, ".agents", "skills", "manual", "SKILL.md"),
      "manual",
      "utf8"
    );

    const plan = await planHarnessInitialization(root, {
      config: {
        version: 1,
        standard: { name: "harness-config" },
        targets: [{ path: "./.agents" }],
      },
      resourceKinds: ["skills"],
    });

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "info",
          code: "harness.init_target_existing_entries",
          path: ".agents",
        }),
      ])
    );
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
