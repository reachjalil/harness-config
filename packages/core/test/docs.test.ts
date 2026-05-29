import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.resolve(REPO_ROOT, relativePath), "utf8");
}

async function readRepoJson<T = unknown>(relativePath: string): Promise<T> {
  return JSON.parse(await readRepoFile(relativePath));
}

async function listTypeScriptSources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptSources(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("HarnessConfig documentation boundaries", () => {
  it("keeps the standard independent of implementation internals", async () => {
    const standard = await readRepoFile("docs/STANDARD.md");

    const forbidden = [
      {
        pattern: /@harnessconfig\//i,
        reason: "package names belong in tooling documentation",
      },
      {
        pattern: /\bpackages\//i,
        reason: "repository layout paths belong in testing or tooling docs",
      },
      {
        pattern: /--[a-z0-9-]+/i,
        reason: "implementation flags belong in tooling documentation",
      },
    ];

    for (const { pattern, reason } of forbidden) {
      expect(standard, reason).not.toMatch(pattern);
    }
  });

  it("keeps README.md and packages/* aligned on the package version", async () => {
    const rootPackage = await readRepoJson<{ version: string }>("package.json");
    const corePackage = await readRepoJson<{ version: string }>(
      "packages/core/package.json"
    );
    const cliPackage = await readRepoJson<{ version: string }>(
      "packages/cli/package.json"
    );
    const harnesscPackage = await readRepoJson<{ version: string }>(
      "packages/harnessc/package.json"
    );

    expect(corePackage.version).toBe(rootPackage.version);
    expect(cliPackage.version).toBe(rootPackage.version);
    expect(harnesscPackage.version).toBe(rootPackage.version);

    const readme = await readRepoFile("README.md");
    expect(
      readme,
      "README badge sentence must mention the published version"
    ).toContain(`\`${rootPackage.version}\``);
  });

  it("keeps the website English content in sync with docs/", async () => {
    const pairs = [
      ["docs/STANDARD.md", "content/spec/en/02-standard.md"],
      ["docs/RATIONALE.md", "content/spec/en/01-rationale.md"],
      ["docs/TOOLING.md", "content/spec/en/05-tooling.md"],
      ["docs/CONFORMANCE.md", "content/spec/en/06-conformance.md"],
      ["docs/ADOPTION.md", "content/spec/en/04-adoption.md"],
    ];

    for (const [docsPath, websitePath] of pairs) {
      const docsText = (await readRepoFile(docsPath)).trim();
      const websiteText = (await readRepoFile(websitePath)).trim();
      const websiteBody = websiteText
        .replace(/^---\n[\s\S]*?\n---\n/, "")
        .trim();
      expect(
        websiteBody,
        `${websitePath} body must match ${docsPath} (frontmatter excluded)`
      ).toBe(docsText);
    }
  });

  it("keeps docs/DIAGNOSTICS.md in sync with implementation codes", async () => {
    const sources = [
      ...(await listTypeScriptSources(
        path.resolve(REPO_ROOT, "packages/core/src")
      )),
      ...(await listTypeScriptSources(
        path.resolve(REPO_ROOT, "packages/cli/src")
      )),
    ];
    const codes = new Set<string>();
    for (const sourcePath of sources) {
      const contents = await readFile(sourcePath, "utf8");
      for (const match of contents.matchAll(/"(harness\.[a-z_]+)"/g)) {
        const value = match[1];
        if (value === "harness.toml") {
          continue;
        }
        codes.add(value);
      }
    }

    const catalog = await readRepoFile("docs/DIAGNOSTICS.md");
    const missing = [...codes].filter(
      (code) => !catalog.includes(`\`${code}\``)
    );
    expect(
      missing,
      "every harness.* diagnostic emitted by the implementation must be in docs/DIAGNOSTICS.md"
    ).toEqual([]);

    const documented = new Set(
      [...catalog.matchAll(/`(harness\.[a-z_]+)`/g)].map((match) => match[1])
    );
    const orphaned = [...documented].filter((code) => !codes.has(code));
    expect(
      orphaned,
      "docs/DIAGNOSTICS.md must not list codes that are never emitted"
    ).toEqual([]);
  });
});
