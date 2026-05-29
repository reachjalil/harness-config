---
title: 模式
seoTitle: Harness config 模式与示例
socialTitle: 面向团队和开发者的实用 Harness config 模式
description: runtime 所有的 mutable 文件、目标输出 ignore、可组合指令、profile 覆盖、团队工具包、个人定制和安全清理的具体示例。
socialDescription: 实用 Harness config 示例，安全地组合 mutable runtime 状态、ignore、profile、dir 组合和 target 清理。
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: zh-cn
sectionCode: "07"
summary: 安全地组合 runtime 所有的 mutable 文件、ignore、profile、dir 组合和清理的具体示例。
llmSummary: 展示 runtime 所有的 mutable 文件、目标输出 ignore、可组合指令、profile 覆盖、团队工具包、个人定制、目标本地 profile、迁移和清理的实用 Harness config 模式。
audience: 在真实仓库中采用 Harness config 的开发者和平台团队。
contentKind: spec
status: draft
updated: 2026-05-28
---

# Harness config 模式

本页展示如何组合标准部分而不丢失主要所有权规则：`.harness/` 是规范源，活动 target 文件夹是带几个受保护本地控件的生成输出。

从 `./.harness/harness.toml` 处的显式 manifest 开始：

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.gemini"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  harness.toml
  resources/
    README.md
    skills/
    rules/
  dir/
    AGENTS.md/
      .harnessComposable
  local/
    resources/
    dir/
.agents/
.claude/
.gemini/
```

Manifest 命名源根和 target。文件系统显示已审阅源住在哪里以及激活可以生成哪些活动 harness surface。

## 资源组

对于大多数迁移，从一个共享的 `.harness/resources` 根开始，并按应生成的 target 路径在其内分组。这让源目录易于检查，并避免在仓库需要之前发明单独的源根。

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"
```

```text
.harness/
  resources/
    README.md
    .claude/
      settings.json
      .harnessMutable
    skills/
      review/
      frontend/
    prompts/
    rules/
    plugins/
  local/
    resources/
```

Target 根文件属于资源根内的 target 根路径：例如 `.claude/settings.json` 变为 `.harness/resources/.claude/settings.json`。如果该文件在第一次种子后是 runtime 所有的，添加包含 `settings.json` 的 `.harness/resources/.claude/.harnessMutable`。

附加资源根在它们代表真实边界时有用：独立可选的关注目录、所有权边界、profile 选择的专门化或私有本地覆盖。例如，测试、部署和 UI 关注可以住在单独的根中，当团队有意通过 manifest 顺序、profile 覆盖或特定 profile 的 dir 指令组合它们时。本地层对个人 skills、plugins、agents、prompts 和提升到跟踪源之前的试验有用。

## 一个活动 surface 的目标输出 ignore

当规则属于一个活动输出子树而不是规范源时，使用目标输出 `.harnessIgnore`。

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

这排除 `.agents/skills/deploy-plan/` 下的最终输出路径：

```text
.agents/skills/deploy-plan/scratch.tmp
.agents/skills/deploy-plan/logs/run.tmp
```

这不影响：

```text
.claude/skills/deploy-plan/scratch.tmp
```

目标输出 ignore 匹配输出路径，不是源路径。它们也仅在 `.harnessIgnore` 文件存在于磁盘上后才参与。在必须在第一次激活时应用规则时，把规则放在仓库根 `.harnessIgnore` 或源本地 `.harnessIgnore` 中。

此模式有意地是 target 本地。它对 gitignored 活动 harness surface、本地开发试验或不应成为共享源的特定机器 runtime 文件最有用。文件被保留并从 target 输出读取，但它不被投影拷贝到那里。

## 逻辑 ignore 重新包含

对宽边界使用浅规则，对选择的例外使用更深的逻辑规则。Profile 本地 ignore 文件在 profile 根的逻辑覆盖位置评估，而不是在物理 profile 文件夹处。

```toml
[[resources]]
path = "./.harness/resources-tooling"

[[targets]]
path = "./.agents"
```

```text
.harnessIgnore
.harnessProfile                  # 包含：cloudflare-react
.harness/
  resources-tooling/
    skills/
      vite-worker-imports-config-skill/SKILL.md
      codex-agent-management/SKILL.md
    cloudflare-react/
      .harnessProfileRoot         # 包含：cloudflare-react
      .harnessIgnore
```

```gitignore
# .harnessIgnore
.harness/resources-tooling/skills/**
```

```gitignore
# .harness/resources-tooling/cloudflare-react/.harnessIgnore
!skills/
!skills/vite-worker-imports-config-skill/
!skills/vite-worker-imports-config-skill/**
```

随着 `cloudflare-react` 活动，只有 `vite-worker-imports-config-skill` 越过投影边界。`codex-agent-management` 保持被忽略，因为 profile 本地文件在 `.harness/resources-tooling/` 处参与，其后代重新包含只命名 Vite worker skill。

## Runtime 所有的 mutable 文件

当仓库应初始化文件一次而 runtime 应在之后拥有它时使用 `.harnessMutable`。

```text
.harnessMutable
.harness/resources/**/settings.local.json
```

```text
.harness/resources/skills/review/settings.local.json
.agents/skills/review/settings.local.json
.claude/skills/review/settings.local.json
```

在第一次激活时，源模板创建 target 文件。在那之后，激活把 target 报告为 `mutable` 并让其字节独自存在，即使 runtime 已经更改了它们。这是权限授予、本地设置、学习到的命令和其他必须在计划中可见而不成为规范源的状态的正确形状。

对永不应越过投影边界的文件使用 ignore 规则。对应作为模板越过一次并属于活动 harness surface 的文件使用 `.harnessMutable`。

## 可组合指令

对持久仓库根文件和不是资源项的目标所有文件使用 `[[dir]]` 源。可组合叶是带空 `.harnessComposable` 标记的目录。其编号部分连接成一个输出文件。当同一标记在配置过的 resources 源下使用时，它在每个 target 内组合投影的资源文件而不是仓库根或目标所有的 dir 输出。

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  dir/
    AGENTS.md/
      .harnessComposable
      100_intro.md
      200_rules.md
    CLAUDE.md/
      .harnessComposable
      .harnessRef          # ../AGENTS.md
      300_claude.md
  local/
    dir/
      AGENTS.md/
        900_local.md
```

投影：

```text
AGENTS.md
CLAUDE.md
```

`AGENTS.md` 由共享部分加任何后续本地部分组成。`CLAUDE.md` 先导入 `AGENTS.md` 叶，然后添加 Claude 特定尾部。当生成消除真实重复或启用 profile/本地覆盖时使用此模式；当组合没有帮助时，把简单根文件保持为普通已跟踪文件。

源本地 `.harnessIgnore` 文件可以移除单独部分：

```text
.harness/dir/AGENTS.md/.harnessIgnore
200_rules.md
```

目标输出 `.harnessIgnore` 文件可以在最终输出路径已知后抑制完整输出：

```text
notes/.harnessIgnore
release.md
```

## 仓库范围 profile

仓库根 `.harnessProfile` 为整个投影选择一个 profile。当 `.harnessProfileRoot` 直接位于配置过的 resources 源下时，其子项覆盖该 resources 源。

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # 包含：deploy

.harness/
  resources/
    skills/
      review/
        SKILL.md
    deploy/
      .harnessProfileRoot  # 包含：deploy
      skills/
        deploy-plan/
          SKILL.md
```

当 `deploy` profile 活动时，`deploy-plan` 作为 skill 投影。`deploy` 文件夹本身不作为资源投影，因为它是覆盖存储。

当覆盖属于一个资源类型时使用此形状。

## 团队提供的 profile 工具包

工具包 profile 可以覆盖 `.harness` 本身并一次性贡献几个逻辑源根。

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # 包含：deploy-kit

.harness/
  kits/
    deploy-kit/
      .harnessProfileRoot # 包含：deploy-kit
      resources/
        skills/
          deploy-plan/
            SKILL.md
      dir/
        AGENTS.md/
          .harnessComposable
          100_deploy.md
```

此工具包覆盖到 `.harness/resources/skills` 和 `.harness/dir` 中。它可以添加 skill 并添加部署特定指令部分，而不变成投影的 `.agents/kits/deploy-kit/` 文件夹。

这是公司提供的部署、安全、前端、后端或入职工具包的正确模型。工具包是已审阅源。选择器决定它在哪里活动。

## 带激活说明的生成 surface

生成的 harness surface 可以在仓库保持已跟踪激活路径时 gitignored。Manifest 和源目录留在版本控制中；活动文件夹可以在检出后重新生成。

```toml
[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

```text
AGENTS.md                         # 面向人和 agent 的激活笔记
package.json                      # 可选 setup:harness 脚本
.gitignore
.harness/
  harness.toml
  resources/
    README.md
    skills/
      harness-config/
        SKILL.md
      review/
.agents/                          # 生成的，gitignored
.claude/                          # 生成的，gitignored
```

```gitignore
# Harness 生成的活动 surface
.agents/
.claude/

# 私有 Harness 覆盖
.harness/local/
```

激活说明应告诉用户和 agent 在应用之前运行 `npx harnessc validate` 和 dry-run 激活。当新检出会让用户面对空 harness 文件夹且没有清晰激活路径时，不要 gitignore 生成的 surface。不要 gitignore 整个 `.harness/`；保持 manifest、共享资源、dir 源、`.harnessIgnore` 和 `.harnessMutable` 声明被跟踪，使活动 surface 保持可重现。

## 个人 AGENTS.md 覆盖

Profile 可以按逻辑源路径添加个人指令部分并移除基础部分。

```text
.harnessProfile          # 包含：my-profile

.harness/
  profiles/
    my-profile/
      .harnessProfileRoot # 包含：my-profile
      dir/
        AGENTS.md/
          .harnessIgnore  # 包含：100_intro.md
          100_my_intro.md
```

如果基础 `AGENTS.md` 有 `100_intro.md` 和 `300_rules.md`，活动 profile 可以替换 intro 同时保留共享规则。Profile 本地 `.harnessIgnore` 针对逻辑路径 `.harness/dir/AGENTS.md/100_intro.md` 评估，不是 `.harness/profiles/my-profile` 下的物理存储路径。

当团队应共享相同选择时跟踪 `.harnessProfile`。当每个开发者应在本地选择自己的 profile 时 gitignore 它。

## 目标本地 profile

目标输出 `.harnessProfile` 文件让不同的活动子树选择不同的 profile 覆盖。

```text
.agents/
  skills/
    .harnessProfile      # 包含：deploy
  rules/
    .harnessProfile      # 包含：no-rules
```

`deploy` profile 适用于 `.agents/skills/` 下。`no-rules` profile 适用于 `.agents/rules/` 下。没有选择器更改 `.claude/`、仓库根输出或同级 `.agents` 子树。

目标输出 `.harnessProfile` 文件在清理期间被保留，原因与目标输出 `.harnessIgnore` 文件被保留相同：它们是活动子树控件，不是投影 payload。

## 迁移手工 agent 文件夹

对于现有仓库，先把持久共享内容移到 `.harness`，并把本地活动控件保留在它们已有意义的位置。

```text
# 之前
.claude/skills/review/SKILL.md
.agents/skills/review/SKILL.md
.agents/skills/review/.harnessIgnore

# 之后
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.agents/skills/review/.harnessIgnore
```

`.agents` ignore 文件可以保留在活动 harness surface 中以仅控制该输出子树。持久 skill 源移到 `.harness`，`.claude` 差异变为资源内的 target 派生 override。

## 所有权建议

把源和 target 角色分开：

- 不要把 `[[targets]]` 条目指向仍是持久源的文件夹。
- 把共享作者内容移到配置过的 resources 源。
- 当本地试验或 runtime 状态比提交生成的输出更重要时，gitignore 活动 harness surface。
- 把 runtime 或产品状态保持在 `.harness/` 之外；把产品缓存和激活记录放在产品所有的文件夹中并忽略它们。
- 对精确文件差异使用 target 派生的 override。如果 target 需要非常不同的 skill，优先选用单独的资源项而不是深 override 树。
- 在 `.harnessMutable` 中声明 runtime 所有的文件，让投影初始化它们一次然后让它们独自存在。
- 不要依赖跟随源或 target 符号链接。把它们视为叶条目，并在激活前审阅任何替换或移除动作。

这些建议保持激活单向：配置过的源根产生 target 输出，活动 harness surface 永远不变为下一个真理源。

## 清理检查清单

在用 `--remove-unmanaged` 运行清理之前，检查计划：

- 受管理文件应该是 `keep`、`create` 或 `update`。
- 第一次激活后，在 `.harnessMutable` 中声明的 runtime 所有的文件应该是 `mutable`。
- 仅在计划显式显示 `remove` 时删除未管理文件。
- 目标输出 `.harnessIgnore` 和 `.harnessProfile` 文件应保留为已保留。
- 清理仅适用于仍声明的 target。在移除其 `[[targets]]` 条目之前清理 target，或使用可调和孤立 target 的更高层激活状态工作流。

迁移后清理有用，但有意是显式的。如果文件仍有价值，在应用删除之前把它移到 `.harness`、声明它为 mutable 或把它保留为目标输出控件。

## 安全检查

在信任仓库或工具实现之前使用这些检查：

- `validate` 应是只读的并应拒绝仓库外的路径。
- 第一次 dry run 应在写入之前解释每个 `create`、`update`、`remove`、`keep`、`mutable` 和保留的未管理条目。
- 对不变输入的第二次激活应对受管理文件收敛到 `keep`，对 runtime 所有的文件收敛到 `mutable`。
- 清理应默认保留未管理条目，仅在删除是显式时才删除它们。
- 即使在未管理清理期间，目标输出 `.harnessIgnore` 和 `.harnessProfile` 文件也应被保留。
- 除非用户显式选择强制重新投影，否则 mutable 文件永远不应被覆盖。
- 会替换或包含声明 target 根的 dir 输出应在应用之前被拒绝。
