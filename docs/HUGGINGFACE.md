# Hugging Face Publishing

Harness config publishes Hugging Face artifacts as generated mirrors. The
canonical specification remains in this repository and at
https://www.harnessconfig.dev/specifications/v1/.

## Outputs

`pnpm run hf:build` writes:

- `dist/huggingface/dataset`: dataset repository payload.
- `dist/huggingface/space`: static Space payload.

The dataset contains localized markdown, canonical docs, examples, metadata,
and LLM-friendly JSON/JSONL snapshots. The Space is a compact AI-readable page
with canonical links back to the website and GitHub repository.

## Publish

Default repositories:

- Dataset: `reachjalil/harness-config-specification`
- Space: `reachjalil/harness-config-spec`

Override them when a dedicated organization exists:

```bash
HF_DATASET_REPO=harness-config/specification \
HF_SPACE_REPO=harness-config/spec \
pnpm run hf:publish
```

Dry-run the commands without uploading:

```bash
pnpm run hf:publish:dry-run
```

The publish script uses the `hf` CLI. Authenticate with `hf auth login` or set
`HF_TOKEN` before publishing.

## Source Of Truth

Do not edit files in `dist/huggingface` directly. Update `content/spec`,
`docs`, or examples in this repository, then rebuild and publish.
