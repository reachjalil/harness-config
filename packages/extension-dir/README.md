# @harnessconfig/extension-dir

Static HarnessConfig extension for composing text files from mirrored
directories under `./.harness/dir`.

```toml
[extensions.dir]
version = 1
activation = "explicit"
path = "./.harness/dir"
```

```text
.harness/dir/
  AGENTS.md/
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .ref
    150_claude.md
```

`CLAUDE.md/.ref` can point to `../AGENTS.md`. Referenced and local parts are
sorted together by numeric prefix and concatenated exactly, without generated
headers or separators.
