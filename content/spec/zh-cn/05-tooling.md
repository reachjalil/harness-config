---
title: 工具
seoTitle: Harness config 工具
socialTitle: 校验和激活 Harness config 的工具
description: npx harnessc 参考实现，包括校验、explain 自省、dry-run 和激活命令。
socialDescription: 校验 Harness config 仓库并应用激活投影的命令层。
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: zh-cn
sectionCode: "05"
summary: "npx harnessc 参考实现：校验、explain 自省、dry-run 和激活命令。"
llmSummary: 描述 Harness config 周围的校验、explain 自省、dry-run、激活、诊断和辅助工具的预期。
audience: CLI 作者和操作 Harness config 仓库的开发者。
contentKind: spec
status: draft
updated: 2026-05-28
---

# Harness config 工具

`harnessc` 是 Harness config 的标准实现。它的存在是为了让仓库可以校验文件形状、预览激活并物化拷贝投影，而无需先写自定义工具。

任何符合工具一致性的其他实现都同等有效。该标准由仓库形状和激活契约定义，不由某个二进制定义。

## 隐私和遥测

Harness config 不收集遥测。

`harnessc` CLI 不发送分析、使用事件、文件路径、仓库名称、命令历史、机器标识符或错误报告。

激活、校验和计划在你的仓库文件上本地运行。CLI 在正常操作中不发出网络请求。

## 命令

```bash
harnessc
harnessc init
harnessc validate
harnessc explain <path>
harnessc activate
harnessc extension activate
```

- `harnessc` 不带命令时校验最近的仓库配置，并打印检测到的 manifest 路径以及建议的后续步骤。
- `harnessc init` 在不带 `--yes` 运行时显示采用计划。带 `--yes` 时，它创建所选 manifest（默认 `./.harness/harness.toml`）、配置过的 resources 源根下的约定或自定义资源文件夹、`.harnessIgnore` 和 `.harnessMutable`。生成的起始 manifest 显式声明 `[[resources]] path = "./.harness/resources"`。使用 `--resources-path <path>` 选择该源根，使用 `--resource <kind>` 在其下创建一个或多个资源类型文件夹，并使用 `--target <path>` 添加显式 `[[targets]]` 条目。
- `harnessc validate` 检查版本支持、仓库本地路径、target 映射、投影 ignore 语法、mutable 声明语法、资源可组合叶、符号链接叶处理和 dir 组合/拷贝问题。
- `harnessc explain <path>` 解释源或输出路径如何参与当前投影计划，包括获胜的源路径、配置过的源根、dir 输出、阻塞诊断以及激活使用的相同投影输入所产生的决定。JSON 输出包括源和目标输出 ignore 跟踪，使调用者可以区分仓库根排除、更深的源本地重新包含、profile 本地逻辑重新包含和目标输出最终边界。
- `harnessc activate` 在不带 `--yes` 运行时显示投影预览，并报告创建、更新、请求的删除、保留的文件、mutable 跳过的文件和保留的未管理项。默认情况下，它把占据投影路径的 target 符号链接报告为冲突；传递 `--replace-target-symlinks` 或设置 `[activation].targetSymlinks = "replace"` 以替换链接本身。
- `harnessc extension activate` 运行已注册的扩展。使用 `--extension <id>` 运行一个声明的扩展，或使用 `--all` 运行每个声明的支持扩展。

`init`、`activate` 和 `extension activate` 是 dry run，除非提供 `--yes`。`init` 的 dry-run 形式替代了之前的 `harnessc plan` 命令，因此单个心智模型 — "无标志预览，`--yes` 写入" — 适用于每个变更命令。

常见自省示例：

```bash
harnessc explain .agents/skills/review/SKILL.md
harnessc explain AGENTS.md
harnessc explain .harness/local/resources/skills/review/SKILL.md
```

未管理的 target 条目默认保留。当 target 应被清理以匹配配置过的源时使用 `--remove-unmanaged`；使用 `--keep-unmanaged` 使默认显式。

生成的 harness surface（如 `.agents`、`.claude`、`.cursor` 和 `.gemini`）当它们可从 `.harness` 重现时可被 gitignored。这样做的项目应保留已跟踪的激活说明，如根指令笔记、README 设置步骤或告诉用户和 agent 在新检出时运行校验和激活的包脚本。

完整迁移后推荐的 `.gitignore` 条目是：

```gitignore
# Harness 生成的活动 surface
.agents/
.claude/
.cursor/
.gemini/

# 私有 Harness 覆盖
.harness/local/
```

保持共享 Harness 源已跟踪：`.harness/harness.toml`、共享 `.harness/resources/**`、使用时的 `.harness/dir/**`、`.harnessIgnore` 和 `.harnessMutable` 声明。不要把 `.harness/` 添加为宽泛 ignore，除非仓库有意选择不共享源目录。

清理仅适用于在所选 manifest 中仍声明的 target。在 target 声明移除后，基础 `harnessc activate` 不再检查或清理该文件夹。先用 `--remove-unmanaged` 清理它，或使用更高层激活状态工作流来调和孤立 target。

默认 manifest 路径是 `./.harness/harness.toml`。当 `--root` 和 `--config` 被省略时，`harnessc` 从当前目录向上搜索该 manifest。传递 `--config <path>` 以针对另一个仓库本地 TOML 文件进行校验、初始化、激活或运行扩展。`harnessc init --resources-path <path>` 把一个 `[[resources]]` 条目写入 manifest，并在该配置过的源根下创建资源文件夹。`harnessc init --resource <kind>` 在配置过的资源根下添加一个资源类型文件夹，并用资源 id 模式校验名称。`harnessc init --target <path>` 为仓库本地 target 路径添加一个 `[[targets]]` 条目。Manifest 路径由工具调用选择；manifest 内的路径保持仓库本地，不相对于 manifest 文件的目录。

激活计划也是面向操作员的所有权视图。受管理文件是仓库所有的投影输出，未管理条目是投影之外的现有 target 状态，mutable 条目是由源初始化但现在由 runtime 所有的 target 文件。

受管理文件直接与当前源投影比较：如果 target 不同，`harnessc activate` 报告 `update`，应用激活用当前源字节覆盖 target。`.harnessMutable` 中声明的 mutable 文件从源创建一次，并在后续激活中被跳过，因为活动 target 字节由 runtime 所有。使用 `--force-mutable` 从源重新投影它们。

Target 符号链接不被跟随。如果 target 符号链接占据投影需要写入的路径，`harnessc activate` 报告 `harness.target_symlink_conflict` 并默认拒绝 `--yes`。当替换链接本身是有意的时，选择显式替换策略之一：

```toml
[activation]
targetSymlinks = "replace"
```

或一次性运行：

```bash
harnessc activate --yes --replace-target-symlinks
```

文件系统行为遵循 v1 发布冻结：

- 符号链接被视为叶条目，不被跟随；
- 占据投影路径的 target 符号链接是冲突，除非通过 manifest 策略或 `--replace-target-symlinks` 选择替换；
- 未管理的 target 条目被保留，除非选择 `--remove-unmanaged`；
- 目标输出 `.harnessIgnore` 和 `.harnessProfile` 文件作为本地控件被保留；
- 用相同输入重复激活对受管理文件收敛到 `keep`，对 runtime 所有的文件收敛到 `mutable`；
- 重叠的 target 或与配置过的源根冲突的 target 是诊断。

选择工作流、市场行为、target 编辑审阅、捕获和其他产品意见属于 `harnessc` 之上。

## Dir 组合和拷贝

在所选 manifest 中声明一个或多个 `[[dir]]` 条目激活有序 dir 源根。运行 `harnessc activate` 与 target 投影一起计划和应用 dir 输出：

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/dir/
  AGENTS.md/
    .harnessComposable
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .harnessComposable
    .harnessRef                       # ../AGENTS.md
    150_claude.md
  .github/
    copilot-instructions.md/
      .harnessComposable
      100_intro.md
  .claude/
    settings.json              # 拷贝模式（无标记）
  notes/
    01_dev_intro.md            # 拷贝模式（无标记）
```

在每个 `[[dir]]` 源内，包含空 `.harnessComposable` 标记文件的目录是可组合叶：它们的数字前缀部分（例如 `100_intro.md`、`200_rules.md`）按顺序连接以产生一个相对仓库的输出文件。没有标记的目录是拷贝文件夹：它们的文件和嵌套文件拷贝到匹配的相对仓库路径。任何深度的单独文件也被拷贝。

同一 `.harnessComposable` 标记也可以在配置过的 resources 源下使用。在该位置，它在每个声明的 target 内组合一个投影的资源文件；它不是 `[[dir]]` 相对仓库的输出。

可组合叶内的 `.harnessRef` 文件导入另一个叶的部分。导入和本地部分一起排序，重复的数字保留所有匹配部分，循环或缺失 `.harnessRef` 目标作为错误报告。

源端 `.harnessIgnore` 规则在 dir 收集期间应用，包括 `.harnessComposable` 叶内的规则和 `./.harness` 之外的自定义 `[[dir]]` 源内的规则。忽略容器跳过其下所有 dir 输出，忽略叶跳过该输出，忽略部分把该部分从组合中排除。目标输出 `.harnessIgnore` 文件也可以在候选输出结构已知后按最终输出路径过滤 dir 输出；目标输出规则在源和 profile 本地规则之后评估，因此它们形成该输出子树的最终边界。范围 target 标题在此模式下被忽略。`.harnessComposable` 标记本身从不被拷贝到任何输出。

Profile 覆盖使用 `.harnessProfile` 选择器和 `.harnessProfileRoot` 源覆盖。根 `.harnessProfile` 全局应用；目标/输出选择器（如 `.agents/skills/.harnessProfile`）仅应用于该输出子树。`.harnessProfileRoot` 必须住在 `.harness`、配置过的 resources 源或配置过的 dir 源下；当活动时，其内容覆盖父源根（对于直接在 resources 源或 dir 根内的标记）、父目录（对于嵌套在资源项或 dir 子树内的可移植 profile 根）或 `.harness`（对于工具包风格的文件夹）。Profile 根不能嵌套在其他 profile 根内。Profile 本地 `.harnessIgnore` 文件匹配那些逻辑覆盖路径，包括 `.harnessComposable` 叶。Dir 计划在计算最终 dir 输出集之前从基础和仅 profile 候选输出发现目标/输出 profile 选择器。

## 单开发者定制

对于独立开发者或想要本地试验而不更改已审阅共享源的团队，`harnessc` 与额外的有序源根一起工作。一个实用模式是：

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

CLI 不要求这些路径存在。项目可以选择在版本控制中忽略 `.harness/local/`、提交它、生成它，或使用不同的路径。后续的根覆盖之前的精确路径资源或 dir 输出；使用 `harnessc explain <path>` 检查为什么特定源或输出路径存在、被忽略、被覆盖或被组合。

当 `.harness/local/` 被 gitignored 时，共享 manifest 仍然可以把它声明为可选后续根。缺失的本地根只是不贡献本地文件；存在的本地根可以为该开发者覆盖精确资源或 dir 输出。

落在声明 `[[targets]]` 路径下的 dir 输出路径合并到该 target 的投影中 — 第二次运行激活对这些文件收敛到 `keep` 动作，包括 target 未管理项清理。会替换或包含 target 根本身的 dir 输出（例如当 `./.claude` 被声明为 target 时在 `.claude` 的 dir 输出）作为 `harness.dir_output_target_overlap` 报告。

## 扩展

`harnessc` 附带一个扩展注册表以保持向前兼容。本次发布不附带内置扩展实现；声明 `[extensions.<id>]` 而 id 不支持的工具看到信息诊断而不是行为。上面的 dir 组合和拷贝 surface 是核心激活的一部分，不是扩展。

```toml
[extensions.example]
version = 1
activation = "explicit"
```

核心标准拥有 `version` 和 `activation`。扩展特定字段属于已注册的扩展实现。普通的 `harnessc extension activate` 仅运行配置为 `activation = "auto"` 的扩展。

## TypeScript 辅助工具

编辑器、CI 脚本和内部工具可以通过 `@harnessconfig/core` 嵌入相同行为：

```ts
import {
  applyHarnessActivation,
  loadHarnessIgnoreMatcher,
  parseHarnessConfigToml,
  planHarnessActivation,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const config = parseHarnessConfigToml(rawToml);
const ignore = await loadHarnessIgnoreMatcher(paths.root);
const validation = await validateHarnessConfig(paths.root);
const activationPlan = await planHarnessActivation(paths.root);
const dryRun = await applyHarnessActivation(paths.root);
```

## 校验器检查

符合的校验器应：

- 使用提供的 `--root` 路径，或在未提供根时使用当前工作目录作为仓库根。嵌套调用应传递 `--root`。
- 解析所选 manifest（默认 `./.harness/harness.toml`），并用清晰诊断拒绝格式错误的输入。
- 拒绝未来不支持的标准版本。
- 校验配置过的 resources 源路径，并拒绝按类型的 manifest 资源声明。
- 验证每个 `[[targets]]` 条目包含必需的仓库本地路径、指向仓库根下并且不与配置过的源根重叠；未识别键报告为信息。
- 使用标准优先级阶段，用仓库根、源本地、profile 本地和目标输出本地规则解析 `.harnessIgnore`。为只创建 runtime 所有的文件单独解析 `.harnessMutable`。
- 在投影之前解析 `.harnessProfile` 选择器和 `.harnessProfileRoot` 覆盖，包括输出选择器的 dir 引导/最终阶段。
- 在任何写入之前显示 create、update、remove、keep、preserve 和 mutable 动作。
- 验证对不变输入重复激活对受管理文件收敛到相同 target 树，并让 mutable 文件保持不变。
- 把声明的 target 与持久源文件夹分开报告。

## 输出

默认输出是带路径、严重性和建议修复的简洁终端报告。人类终端输出在输出流支持颜色时可以为标题、诊断严重性和动作类型使用 ANSI 颜色。实现应避免在重定向输出中使用颜色，遵守 `NO_COLOR`，并保持 `--json` 输出无 ANSI 转义以便自动化和 CI。
