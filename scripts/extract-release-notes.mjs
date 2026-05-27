import { readFileSync } from "node:fs";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!tag) {
  throw new Error("Pass a release tag or set GITHUB_REF_NAME.");
}

const version = tag.startsWith("v") ? tag.slice(1) : tag;
const source = readFileSync("docs/RELEASE_NOTES.md", "utf8");
const heading = `## ${version}`;
const start = source.indexOf(heading);

if (start === -1) {
  throw new Error(`docs/RELEASE_NOTES.md does not contain ${heading}.`);
}

const next = source.indexOf("\n## ", start + heading.length);
const section = source
  .slice(start + heading.length, next === -1 ? undefined : next)
  .trim();

console.log(section);
