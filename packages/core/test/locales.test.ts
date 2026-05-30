import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

const LOCALES = ["es", "fr-fr", "zh-cn"] as const;
const SECTION_FILES = [
  "00-overview.md",
  "01-rationale.md",
  "02-standard.md",
  "03-extensions.md",
  "04-adoption.md",
  "05-tooling.md",
  "06-conformance.md",
  "07-patterns.md",
] as const;

const FIXED_IDENTIFIER_TOKENS = [
  ".harnessIgnore",
  ".harnessMutable",
  ".harnessProfile",
  ".harnessProfileRoot",
  ".harnessComposable",
  ".harnessRef",
  "[[resources]]",
  "[[targets]]",
  "[[dir]]",
  "[extensions",
  "[activation]",
] as const;

const RFC_2119_KEYWORDS = [
  "MUST",
  "MUST NOT",
  "SHALL",
  "SHALL NOT",
  "SHOULD",
  "SHOULD NOT",
  "MAY",
  "REQUIRED",
  "RECOMMENDED",
  "OPTIONAL",
] as const;

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.resolve(REPO_ROOT, relativePath), "utf8");
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

function readFrontmatterField(text: string, field: string): string | undefined {
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  return frontmatter
    .split("\n")
    .find((line) => line.startsWith(`${field}:`))
    ?.replace(`${field}:`, "")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function countLiteralToken(text: string, token: string): number {
  const escaped = escapeRegExp(token);
  const before = /[A-Za-z0-9_.-]/.test(token[0] ?? "")
    ? "(?<![A-Za-z0-9_.-])"
    : "";
  const after = /[A-Za-z0-9_.-]/.test(token.at(-1) ?? "")
    ? "(?![A-Za-z0-9_.-])"
    : "";
  return countMatches(text, new RegExp(`${before}${escaped}${after}`, "g"));
}

function countKeyword(text: string, keyword: string): number {
  const normalized = text.replace(/\s+/g, " ");
  const pattern = keyword.replace(/ /g, "\\s+");
  return countMatches(normalized, new RegExp(`\\b${pattern}\\b`, "g"));
}

function extractDocumentedTokens(englishBodies: string[]): string[] {
  const text = englishBodies.join("\n");
  const diagnostics = [...text.matchAll(/\bharness\.[a-z_]+\b/g)].map(
    (match) => match[0]
  );
  const flags = [...text.matchAll(/(?<![\w-])--[a-z][a-z0-9-]*/g)].map(
    (match) => match[0]
  );
  return [...new Set([...FIXED_IDENTIFIER_TOKENS, ...diagnostics, ...flags])];
}

describe("HarnessConfig translated specification content", () => {
  it("keeps locale sections structurally aligned with English", async () => {
    const englishTexts = await Promise.all(
      SECTION_FILES.map((file) => readRepoFile(`content/spec/en/${file}`))
    );
    const englishBodies = englishTexts.map(stripFrontmatter);
    const identifierTokens = extractDocumentedTokens(englishBodies);

    for (const [index, file] of SECTION_FILES.entries()) {
      const englishText = englishTexts[index] ?? "";
      const englishBody = englishBodies[index] ?? "";
      const englishUpdated = readFrontmatterField(englishText, "updated");
      for (const locale of LOCALES) {
        const localePath = `content/spec/${locale}/${file}`;
        const localeText = await readRepoFile(localePath);
        const localeBody = stripFrontmatter(localeText);

        const localeUpdated = readFrontmatterField(localeText, "updated");
        expect(
          localeUpdated,
          `${localePath} updated frontmatter must match en/${file}: en=${englishUpdated} locale=${localeUpdated}`
        ).toBe(englishUpdated);

        const englishHeadingCount = countMatches(englishBody, /^#{1,6} /gm);
        const localeHeadingCount = countMatches(localeBody, /^#{1,6} /gm);
        expect(
          localeHeadingCount,
          `${localePath} heading count must match en/${file}: en=${englishHeadingCount} locale=${localeHeadingCount}`
        ).toBe(englishHeadingCount);

        const englishFenceCount = countMatches(englishBody, /^```/gm);
        const localeFenceCount = countMatches(localeBody, /^```/gm);
        expect(
          localeFenceCount,
          `${localePath} fenced-code delimiter count must match en/${file}: en=${englishFenceCount} locale=${localeFenceCount}`
        ).toBe(englishFenceCount);

        for (const token of identifierTokens) {
          const englishCount = countLiteralToken(englishBody, token);
          const localeCount = countLiteralToken(localeBody, token);
          expect(
            localeCount,
            `${localePath} identifier ${token} count must match en/${file}: en=${englishCount} locale=${localeCount}`
          ).toBe(englishCount);
        }

        for (const keyword of RFC_2119_KEYWORDS) {
          const englishCount = countKeyword(englishBody, keyword);
          const localeCount = countKeyword(localeBody, keyword);
          expect(
            localeCount,
            `${localePath} RFC 2119 keyword ${keyword} count must match en/${file}: en=${englishCount} locale=${localeCount}`
          ).toBe(englishCount);
        }
      }
    }
  });
});
