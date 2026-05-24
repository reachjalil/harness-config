import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("HarnessConfig documentation boundaries", () => {
  it("keeps the standard independent of the reference implementation", async () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const standard = await readFile(
      path.resolve(currentDir, "../../../docs/STANDARD.md"),
      "utf8"
    );

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
});
