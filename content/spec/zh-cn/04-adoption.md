---
title: 采用
seoTitle: 采用 Harness config
socialTitle: 如何在仓库中采用 Harness config
description: 面向 greenfield 启动、迁移、profile、可组合指令和安全清理的实践工作流。
socialDescription: 一个把 agent 配置移入持久 Harness config 源目录的实用路径，带 profile 和安全清理。
canonicalPath: /specifications/v1/adoption/
slug: adoption
order: 4
locale: zh-cn
sectionCode: "04"
summary: 面向 greenfield 启动、迁移、profile、可组合指令和安全清理的实践工作流。
llmSummary: 覆盖创建 Harness config 目录、声明 target、预览激活、迁移、profile 和安全清理的工作流。
audience: 在新仓库或现有仓库中引入 Harness config 的开发者。
contentKind: spec
status: draft
updated: 2026-05-29
---

# 采用 Harness config

本指南描述两条路径：greenfield（没有现有的活动 agent 文件夹）和迁移（仓库已经有 `.claude/`、`.cursor/`、`.agents/` 或类似目录）。

## Greenfield

Harness config v1 从一个小源契约开始：

1. 创建 `./.harness/harness.toml`，包含 `version = 1`，或选择另一个仓库本地 manifest 路径并显式传给工具。
2. 在显式 `[[resources]]` 源根下添加资源文件夹和文件，通常是 `.harness/resources`，例如 `.harness/resources/skills`、`.harness/resources/rules` 或 `.harness/resources/hooks.json`。
3. 在所选 manifest 中显式声明每个投影 target。
4. 用 `.harnessIgnore` 把仅源文件保持在活动 target 之外，并用 `.harnessMutable` 标记应初始化一次的 runtime 所有的文件。Mutable 文件通常应该是本地 target 状态的源模板，而不是持久共享配置。
5. 在写入 target 文件夹之前 dry-run 激活。

对于第一个小设置，显示所选 manifest 和源树两者：

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"
```

```text
AGENTS.md                         # 已跟踪的激活/根指令
.harnessIgnore
.harnessMutable
.harness/
  harness.toml
  resources/
    README.md
    skills/
      review/
        SKILL.md
.agents/                          # 激活后生成
```

当 `AGENTS.md`、`CLAUDE.md` 或类似根指令文件简单且已经一致时，把它们保持为普通已跟踪文件。仅当生成、组合、profile 或本地覆盖让仓库更易理解时，才把它们移到 `[[dir]]`。

`harnessc` 是该工作流的标准实现：

```bash
harnessc init
harnessc init --yes --resource skills --target ./runtime/agent
harnessc validate
harnessc explain .agents/skills/review/SKILL.md
harnessc activate
harnessc activate --yes
```

## 迁移现有仓库

已经有 `.claude/` 或 `.cursor/` 等 harness surface 的仓库以增量方式采用 Harness config。迁移的形状很重要：配置过的源根必须成为规范输入，而不是 target。

推荐顺序：

1. **快照现有 target。** 提交当前活动文件夹，或把它们拷贝到分支。采用是可逆的，但已知良好的基线让审阅更容易。
2. **把持久内容移到清晰的资源布局。** 对于第一次完整迁移，优先选用一个 `./.harness/resources` 根并在其内按用途分组：工作流、策略、团队、模式、agent 集、产品领域或工具包。大多数 `.claude/skills/foo/` 内容变为 `./.harness/resources/skills/foo/`。仅对一个 agent 不同的文件移入匹配项 override 文件夹（例如 `./.harness/resources/skills/foo/.claude/`）。Target 根文件（如 `.claude/settings.json` 或 `.claude/hooks.json`）属于 resources 根下的匹配 target 派生路径，例如 `./.harness/resources/.claude/settings.json` 或 `./.harness/resources/.claude/hooks.json`。仅为可选关注目录（如 testing、deployment 或 UI 工作）、独立所有权边界、profile 选择的专门化或本地/私有覆盖添加更多配置过的资源根。

   ```toml
   [[resources]]
   path = "./.harness/resources"

   [[resources]]
   path = "./.harness/local/resources"

   [[targets]]
   path = "./.agents"

   [[targets]]
   path = "./.claude"
   ```

   ```text
   .harness/
     resources/
       README.md
       .claude/
         settings.json
         .harnessMutable
       skills/
       prompts/
       rules/
       plugins/
     local/
       resources/
   ```

   这种配对让迁移审阅具体：审阅者可以看到哪个共享源根被投影、哪些 target 级文件被初始化以及哪个本地源根是私有或试验性的。随着 Harness config 成熟，团队可以把关注拆到额外的根（如 `./.harness/resources-testing`、`./.harness/resources-deployment` 或 `./.harness/resources-ui`），并通过 manifest 顺序、profile 覆盖或特定 profile 的 dir 指令组合它们。
3. **在所选 manifest 中声明 target。** 为你想要重新生成的每个 harness surface 添加一个 `[[targets]]` 条目。Target 仅在此处出现时接收投影。用显式 `[[resources]]` 条目声明每个共享源。
4. **慎重地写 `.harnessIgnore` 和 `.harnessMutable`。** 日志、scratch 文件、按工具元数据和 skill `metadata.toml` 通常属于 ignore 规则，因为它们不应跨越投影边界。Runtime 写回的文件（权限、本地设置、学习到的命令）当源目录应初始化它们一次并 runtime 应在之后拥有它们时属于 `.harnessMutable`。在声明它们 mutable 之前把这些种子文件拷贝到 `.harness`，让新检出收到初始版本。仓库范围规则通常住在 `./.harnessIgnore` 中；特定资源或 dir 的规则可以住在源本地 `.harnessIgnore` 文件中，用户/本地输出偏好可以住在目标输出文件（如 `runtime/agent/skills/foo/.harnessIgnore`）中。目标输出文件在活动 harness surface 是 gitignored 且开发者需要本地临时边界时有用；共享规则应住在源中。优先级遵循逻辑目录深度，因此更深的源/profile 规则可以重新包含选中的路径，同时目标输出规则保持最终边界。
5. **仅在 profile 覆盖澄清所有权时添加它们。** 把 `.harnessProfileRoot` 放在 `.harness` 下、配置过的 resources 源下或配置过的 dir 源下用于可选工具包或个人覆盖，并用仓库根或目标输出 `.harnessProfile` 文件选择它们。Profile 本地 `.harnessIgnore` 文件可以为该 profile 隐藏基础文件或可组合部分，并在 profile 覆盖位置评估。先把 profile 用作跨资源组的可切换模式，仅在它们真正添加或替换内容时用作文件覆盖。
6. **Dry run、解释、审阅，然后应用。** `harnessc activate` 在不写入的情况下打印计划。对需要检查的特定源或输出使用 `harnessc explain <path>`，然后对快照审阅 `create` / `update` / `remove` 动作并用 `--yes` 重新运行。
7. **重新运行激活。** 对不变输入的第二次 dry run 应该对受管理文件收敛到 `keep`，对 runtime 所有的文件收敛到 `mutable`。如果不是这样，源树仍然与 target 漂移；在依赖该标准之前调和它。

迁移后，活动文件夹是派生的：它们可以随时从配置过的源根加 manifest 被移除和重新生成。团队也可以 gitignore 那些活动 harness surface，当它们想要更多空间用于本地试验、runtime 状态或工具特定 scratch 文件时。权衡是有意的：审阅在 `.harness` 和所选 manifest 中发生，受管理 target 文件保持可重现，`.harnessMutable` target 文件把 runtime 所有的状态保持在规范源树之外。

## Gitignore 建议

仅在真理源清楚后使用 `.gitignore`：

- **跟踪共享 Harness 源。** 提交 `.harness/harness.toml`、共享 `.harness/resources/**`、使用时的 `.harness/dir/**`、`.harnessIgnore` 和重现生成输出所需的 `.harnessMutable` 声明。
- **在收敛后 gitignore 生成的 harness surface。** 一旦激活收敛且每个持久资源在 `.harness` 中被代表，文件夹（如 `.agents/`、`.claude/`、`.cursor/` 和 `.gemini/`）可以被忽略。保留已跟踪的激活说明，如根指令笔记、README 设置步骤或运行校验和激活的包脚本。
- **如果需要，gitignore 本地开发者覆盖。** 用 `.harness/local/` 存放私有 skills、prompts、试验和本地 dir 覆盖，然后在那些文件不应共享时把它添加到 `.gitignore`。
- **不要依赖第一次激活的 gitignored 目标输出控件。** 目标输出 `.harnessIgnore` 或 `.harnessProfile` 仅在它在生成的输出中存在后参与。把共享的第一次激活边界放在源本地 `.harnessIgnore` 文件或仓库根 `.harnessIgnore` 中。

完整迁移后的示例：

```gitignore
# Harness 生成的活动 surface
.agents/
.claude/
.cursor/
.gemini/

# 私有 Harness 覆盖
.harness/local/
```

不要忽略整个 `.harness/`；那会隐藏重新生成活动 harness surface 所需的 manifest 和已审阅源。

## 常见陷阱

- **把活动文件夹既当作源又当作 target。** 不要把 `[[targets]]` 条目指向你也直接编辑的文件夹。下次激活会报告漂移或覆盖活动编辑。如果文件夹目前必须保持为源，把它留在 `[[targets]]` 之外。
- **忘记声明 target。** 资源仅投影到声明的 target。仓库可以在磁盘上有 `./.harness/resources/skills/foo/` 和 `.claude/`，仍然看到"没有创建" — 因为 `./.claude` 不在 `[[targets]]` 中。
- **把产品或 runtime 状态放在 `.harness/` 下。** `./.harness/` 是为持久、可审阅源的。激活记录、漂移哈希和产品缓存属于产品所有的文件夹（如 `.harnex/`）和 `.harnessIgnore`。
- **意外把 target 根文件放在工具包中。** Target 根文件（如 `.claude/settings.json`）应该在 `.harness/resources/.claude/settings.json` 处表示，而不是在 skill 文件夹或不相关的资源组内。当它应该初始化一次然后变为 runtime 所有时把它标记为 mutable。
- **用 override 广泛 fork 内容。** Override 文件夹替换精确相对路径或添加新文件。它们故意是个小锤子；如果 target 需要 skill 的非常不同的版本，优先选用单独的资源项而不是深 override 树。
- **把 runtime 写入的文件作为源提交。** 像 `.claude/settings.local.json` 这样的文件通常应该作为种子拷贝到 `.harness`，并在 `.harnessMutable` 中声明，让投影初始化它们一次然后让它们独自存在。如果该文件后来变为共享策略，把期望的字节提升回配置过的源根并有意地强制 mutable 重新投影。
- **期望目标输出 ignore 文件在它存在之前。** 目标输出 `.harnessIgnore` 仅在它已经在磁盘上之后参与。对于必须在第一次激活时应用的规则，使用根文件。
- **把 Harness config 控件作为 payload 投影。** 声明文件（如 `.harnessIgnore`、`.harnessMutable`、`.harnessProfile` 和 `.harnessProfileRoot`）作为控件读取，不作为受管理文件拷贝到 target。
- **指向 target 的符号链接。** Harness config v1 不跟随符号链接。如果符号链接占据激活需要写入的路径，激活默认报告冲突。仅当替换链接本身是有意的时，手动替换链接、设置 `[activation].targetSymlinks = "replace"` 或使用 `--replace-target-symlinks`。

## 范围提醒

标准本身仍限于源布局、target 声明、override、投影 ignore、mutable 文件和确定性拷贝投影。特定产品的选择、市场、target 编辑审阅、激活记录、捕获和远程同步属于基础标准之上。
