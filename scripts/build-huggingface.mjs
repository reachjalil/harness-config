import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputRoot = path.join(root, "dist", "huggingface");
const datasetDir = path.join(outputRoot, "dataset");
const spaceDir = path.join(outputRoot, "space");
const canonicalSpecUrl = "https://www.harnessconfig.dev/specifications/v1/";
const githubUrl = "https://github.com/reachjalil/harness-config";
const datasetRepo =
  process.env.HF_DATASET_REPO ?? "reachjalil/harness-config-specification";
const spaceRepo = process.env.HF_SPACE_REPO ?? "reachjalil/harness-config-spec";

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(absolute)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolute);
    }
  }
  return files.toSorted((left, right) => left.localeCompare(right));
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { metadata: {}, body: markdown };
  }

  const metadata = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) {
      continue;
    }
    const value = pair[2].trim();
    metadata[pair[1]] = value.replace(/^["']|["']$/g, "");
  }
  return {
    metadata,
    body: markdown.slice(match[0].length).trim(),
  };
}

function canonicalPathFor(metadata) {
  if (metadata.canonicalPath) {
    return new URL(metadata.canonicalPath, "https://www.harnessconfig.dev")
      .href;
  }
  return canonicalSpecUrl;
}

function datasetCard(sourceCommit) {
  return `---
license: apache-2.0
language:
- en
- es
- fr
- zh
pretty_name: Harness config v1 specification
tags:
- harness-config
- ai-agents
- agent-configuration
- codex
- claude
- cursor
- gemini
- specification
- markdown
- jsonl
configs:
- config_name: default
  data_files:
  - split: train
    path: harness-config-v1.jsonl
---

# Harness config v1 specification

This dataset is a generated mirror of the Harness config v1 specification for
AI agents, retrieval systems, and documentation search.

**Canonical source:** ${canonicalSpecUrl}

**Source repository:** ${githubUrl}

**Source commit:** \`${sourceCommit ?? "unknown"}\`

Harness config is a repository-local standard for keeping reusable AI agent
instructions, skills, rules, plugins, and related configuration in reviewed
source roots, then projecting them into explicit live harness surfaces such as
\`AGENTS.md\`, \`.agents\`, \`.claude\`, \`.cursor\`, and \`.gemini\`.

## Files

- \`spec/\`: localized markdown specification pages copied from the canonical repository.
- \`canonical/\`: canonical repository docs for the standard, conformance, tooling, adoption, and testing.
- \`examples/\`: small Harness config layouts for agents and retrieval tools.
- \`harness-config-v1.jsonl\`: LLM-friendly section rows with canonical URLs and metadata.
- \`harness-config-v1.documents.json\`: document-level JSON snapshot.
- \`metadata.json\`: generation metadata.

## Canonical URL policy

This Hugging Face dataset is a discovery and retrieval mirror. The canonical
specification remains at ${canonicalSpecUrl}. When citing or linking the
standard, prefer the canonical website URL.
`;
}

function spaceReadme() {
  return `---
title: Harness config v1 specification
sdk: static
app_file: index.html
license: apache-2.0
pinned: false
---

# Harness config v1 specification

Compact AI-readable landing page for the Harness config v1 specification.

Canonical source: ${canonicalSpecUrl}
`;
}

function spaceHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Harness config v1 specification</title>
    <meta
      name="description"
      content="AI-readable mirror of the Harness config v1 specification with canonical links to harnessconfig.dev."
    />
    <link rel="canonical" href="${canonicalSpecUrl}" />
    <style>
      :root {
        color: #111827;
        background: #ffffff;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
      }
      main {
        max-width: 840px;
        margin: 0 auto;
        padding: 72px 24px;
      }
      .eyebrow {
        color: #6b7280;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0;
        font-size: clamp(42px, 8vw, 82px);
        line-height: 0.95;
        letter-spacing: -0.03em;
      }
      p,
      li {
        color: #4b5563;
        font-size: 18px;
        line-height: 1.65;
      }
      a {
        color: #111827;
        font-weight: 700;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 32px 0;
      }
      .button {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 12px 16px;
        text-decoration: none;
      }
      .button.primary {
        background: #111827;
        color: #ffffff;
      }
      code {
        background: #f3f4f6;
        border-radius: 4px;
        padding: 2px 5px;
      }
      section {
        border-top: 1px solid #e5e7eb;
        margin-top: 40px;
        padding-top: 24px;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">AI-readable specification mirror</div>
      <h1>Harness config v1</h1>
      <p>
        Harness config keeps reusable agent resources in reviewed source roots,
        declares live harness surfaces as explicit targets, and projects
        ordinary files into tools such as Codex, Claude, Cursor, and Gemini.
      </p>
      <div class="actions">
        <a class="button primary" href="${canonicalSpecUrl}">Canonical specification</a>
        <a class="button" href="https://huggingface.co/datasets/${datasetRepo}">Dataset mirror</a>
        <a class="button" href="${githubUrl}">GitHub source</a>
      </div>
      <section>
        <h2>Source of truth</h2>
        <p>
          This Space is a generated discovery page. The canonical standard is
          published at <a href="${canonicalSpecUrl}">harnessconfig.dev/specifications/v1</a>
          and maintained in <a href="${githubUrl}">reachjalil/harness-config</a>.
        </p>
      </section>
      <section>
        <h2>LLM retrieval files</h2>
        <ul>
          <li><code>harness-config-v1.jsonl</code> contains section-level rows.</li>
          <li><code>harness-config-v1.documents.json</code> contains document snapshots.</li>
          <li><code>spec/</code> contains localized markdown pages.</li>
        </ul>
      </section>
    </main>
  </body>
</html>
`;
}

function examplesReadme() {
  return `# Harness config example

This minimal layout declares two live harness surfaces and keeps durable skill
source in \`.harness/resources\`.

\`\`\`toml
version = 1

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
\`\`\`
`;
}

async function writeExamples() {
  const exampleRoot = path.join(datasetDir, "examples", "minimal-agent-repo");
  await mkdir(
    path.join(exampleRoot, ".harness", "resources", "skills", "review"),
    {
      recursive: true,
    }
  );
  await writeFile(
    path.join(exampleRoot, ".harness", "harness.toml"),
    `version = 1

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
`,
    "utf8"
  );
  await writeFile(
    path.join(
      exampleRoot,
      ".harness",
      "resources",
      "skills",
      "review",
      "SKILL.md"
    ),
    `---
name: review
description: Review code changes for correctness and maintainability.
---

# Review Skill

Use this skill when reviewing repository changes before activation.
`,
    "utf8"
  );
  await writeFile(
    path.join(exampleRoot, "README.md"),
    examplesReadme(),
    "utf8"
  );
}

async function main() {
  const sourceCommit = git(["rev-parse", "HEAD"]);
  const sourceStatus = git(["status", "--short"]);
  const generatedAt = new Date().toISOString();

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(datasetDir, { recursive: true });
  await mkdir(spaceDir, { recursive: true });

  await cp(path.join(root, "content", "spec"), path.join(datasetDir, "spec"), {
    recursive: true,
  });
  await mkdir(path.join(datasetDir, "canonical"), { recursive: true });
  for (const file of [
    "README.md",
    "docs/STANDARD.md",
    "docs/CONFORMANCE.md",
    "docs/TOOLING.md",
    "docs/ADOPTION.md",
    "docs/TESTING.md",
  ]) {
    await cp(path.join(root, file), path.join(datasetDir, "canonical", file));
  }
  await writeExamples();

  const markdownFiles = await listMarkdownFiles(
    path.join(root, "content", "spec")
  );
  const documents = [];
  const rows = [];
  for (const absolute of markdownFiles) {
    const relative = path.relative(
      path.join(root, "content", "spec"),
      absolute
    );
    const [locale] = relative.split(path.sep);
    const markdown = await readFile(absolute, "utf8");
    const { metadata, body } = parseFrontmatter(markdown);
    const document = {
      id: `${locale}/${metadata.slug ?? path.basename(relative, ".md")}`,
      locale,
      title: metadata.title,
      slug: metadata.slug,
      sectionCode: metadata.sectionCode,
      order: Number(metadata.order ?? 0),
      canonicalUrl: canonicalPathFor(metadata),
      sourcePath: `spec/${relative.split(path.sep).join("/")}`,
      summary: metadata.summary,
      llmSummary: metadata.llmSummary,
      content: body,
    };
    documents.push(document);
    rows.push({
      ...document,
      text: `${document.title ?? ""}\n\n${document.summary ?? ""}\n\n${body}`.trim(),
      sourceCommit,
    });
  }

  await writeFile(
    path.join(datasetDir, "harness-config-v1.documents.json"),
    `${JSON.stringify({ generatedAt, sourceCommit, documents }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(datasetDir, "harness-config-v1.jsonl"),
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8"
  );
  await writeFile(
    path.join(datasetDir, "metadata.json"),
    `${JSON.stringify(
      {
        name: "Harness config v1 specification",
        canonicalUrl: canonicalSpecUrl,
        repository: githubUrl,
        sourceCommit,
        dirty: Boolean(sourceStatus),
        generatedAt,
        datasetRepo,
        spaceRepo,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(datasetDir, "README.md"),
    datasetCard(sourceCommit),
    "utf8"
  );

  await writeFile(path.join(spaceDir, "README.md"), spaceReadme(), "utf8");
  await writeFile(path.join(spaceDir, "index.html"), spaceHtml(), "utf8");

  console.log(`Built Hugging Face dataset artifacts: ${datasetDir}`);
  console.log(`Built Hugging Face Space artifacts: ${spaceDir}`);
}

await main();
