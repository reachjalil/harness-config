---
title: 标准
seoTitle: Harness config 标准
socialTitle: Harness config 仓库配置标准
description: 关于 .harness 源布局、激活投影、runtime 所有的 mutable 文件、由 target 派生的 override、.harnessIgnore 和 .harnessMutable 优先级、profile 覆盖和一致性边界的规范定义。
socialDescription: 关于源资源、runtime 所有的 mutable 文件、target、override、ignore、mutable 声明、profile 覆盖、扩展和激活行为的规范定义。
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: zh-cn
sectionCode: "02"
summary: 关于术语、仓库形状、TOML、投影、runtime 所有的 mutable 文件、override、ignore、mutable 声明、profile、扩展和一致性的规范定义。
llmSummary: 定义 .harness 仓库形状、TOML 契约、激活投影、runtime 所有的 mutable 文件、由 target 派生的 override、ignore 和 mutable 优先级、profile 覆盖、扩展声明和一致性边界。
audience: 工具作者、标准审阅者和技术实现者。
contentKind: spec
status: draft
updated: 2026-05-28
---

# Harness config 标准

**状态：** Version 1 规范提议。本文档描述的文件形状、manifest schema、投影契约和 ignore 语法被设计为可在不参考参考代码的情况下实现，但公开契约仍在提议审阅中。在公开发布、一致性 fixture、采用者仓库和外部反馈成熟之前，把 TypeScript 包视为 alpha 参考实现。一旦 v1 被接受，会使 v1 仓库或 v1 实现失效的更改保留给 v2。

Harness config 是一个仓库本地标准，用于声明持久的 *harness 资源*（条件化 AI 编码 agent 行为的 prompts、skills、rules、plugins 和类似文件）并以可审阅、可重现的方式把它们投影到 harness surface。

该标准分离三种所有权类别：规范的仓库所有的源、生成的 harness surface 输出，以及 runtime 所有的 mutable target 文件。Mutable 文件仍然从源声明并可由投影初始化，但在第一次激活后，活动的 target 字节属于 runtime，直到显式的强制决定重新投影源模板。

仓库保持中立的源根并把它们投影到声明的 target 文件夹。默认 manifest 是 `./.harness/harness.toml`；工具也可以使用另一个仓库本地 TOML 文件（当显式选择该路径时）。持久资源住在有序的 `[[resources]]` 源根下。相对仓库的一次性输出住在有序的 `[[dir]]` 源根下。因此 `./.harness` 目录是源存储的约定，而不是 manifest 的必需位置。投影由 `.harnessIgnore` 规则文件过滤，而只初始化、runtime 所有的文件在单独的 `.harnessMutable` 规则文件中声明。仓库根 `./.harnessIgnore` 设置仓库范围的排除边界，仓库根 `./.harnessMutable` 设置仓库范围的 mutable 初始化边界。本地文件可以与源子树相邻。目标输出 `.harnessIgnore` 文件可以放在活动输出子树中作为本地输出过滤器。每个接收投影的目标输出文件夹都是显式的；没有隐式 target 也没有保留的 target 文件夹名称。

核心资源投影故意不定义启用/禁用注册表或选择格式。激活是投影的涌现属性：一个资源在 target 中 *活动* 当且仅当它的文件出现在计算出的 target 树中，而当它们在下一次投影中缺席时是 *非活动*。选择、分组、市场行为和类似关注属于标准之上的产品层。

扩展在标准层有最小的声明和激活策略；每个扩展的具体行为由该扩展拥有。

## 规范语言

本文档中的关键词 `MUST`、`MUST NOT`、`REQUIRED`、`SHALL`、`SHALL NOT`、`SHOULD`、`SHOULD NOT`、`RECOMMENDED`、`MAY` 和 `OPTIONAL` 应按 [RFC 2119] 和 [RFC 8174] 中描述的方式解释，且仅当它们以全大写出现时如此。根据 RFC 2119 的定义，规范关键词保留为英文大写。

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174

## 术语

这些术语在本文档中有特定含义。文档后面的章节给出更详细定义时，该章节具有权威性。

- **Harness** — 消费仓库指令、上下文、工具和配置以在项目上操作的 AI agent runtime 或开发者面向工具。
- **Harness surface** — harness 读取的仓库本地文件和文件夹，如 `AGENTS.md`、`.agents`、`.claude`、`.cursor` 或其他声明的目标输出。
- **约定根** — 仓库根的 `./.harness` 目录，通常用于资源、dir 源文件、profile 和其他源存储。它不是必需的 manifest 位置。
- **Manifest** — 所选仓库本地 TOML 文件（默认 `./.harness/harness.toml`），声明标准版本、有序的 resources 源、有序的 dir 源、target 和扩展。
- **Resources 源** — 由 `[[resources]]` `path` 声明的仓库本地目录，其文件、文件夹和资源可组合叶被投影到每个声明的 target。多个 resources 源按 manifest 顺序分层。
- **资源类型** — resources 源下的源材料类别，如 `skills`、`rules`、`hooks` 或 `plugins`。类型是目录名称，不是保留的 schema 概念。
- **资源项** — 通常是 `<resources>/<kind>/<name>` 下的一个文件夹，例如 `./.harness/resources/skills/review`。项文件夹是审阅的约定单元，但 resources 源也可以包含直接文件，如 `./.harness/resources/hooks.json`。
- **Target** — 在所选 manifest 中声明的仓库本地目录，接收配置过的 resources 源的投影。
- **Override 文件夹** — 资源项内（例如 `./.harness/resources/skills/review/` 中的 `.claude/`）或直接在 `./.harness/resources` 中的紧邻点前缀子文件夹，其文件在投影到匹配 target 时替换或添加到规范文件。
- **Dir 源** — 由 `[[dir]]` `path` 声明的仓库本地目录。其内容投影到相对仓库的输出路径，可以通过组合（标记 `.harnessComposable` 的目录，其编号部分连接成一个输出文件）或直接拷贝（dir 源下的任何其他目录或文件拷贝到匹配的相对仓库路径）。多个 dir 源按 manifest 顺序分层。
- **可组合标记** — 放在 resources 源或 dir 源中目录里的空文件 `.harnessComposable`，将其标记为可组合叶。在 resources 下，叶在每个 target 中组合一个投影的资源文件。在 dir 源下，叶组合一个相对仓库的输出文件。没有标记时，资源目录保持为普通资源文件夹，dir 目录被视为拷贝文件夹。
- **投影** — 从 `(源根、manifest、配置过的源、override、ignore 规则、mutable 规则)` 到按 target 的文件树的计算映射。
- **激活** — 把投影物化到磁盘上一个或多个 target 文件夹的行为。
- **Mutable 文件** — 由 `.harnessMutable` 声明的投影 target 文件；源提供初始模板，runtime 在第一次投影后拥有 target 字节。
- **符合的仓库 / 工具** — 见 [一致性](/specifications/v1/conformance/)。

## 版本控制

当前标准版本是 `1`。规范版本是完整的标准版本。Patch、minor、prerelease 和包版本属于 CLI、工具、扩展和实现发布，不属于规范 URL 空间或 manifest 的 `version` 字段。

实现 MUST 拒绝所选 manifest 文件的顶级 `version` 不是受支持整数的情况，诊断 MUST 同时命名遇到的值和支持的版本。

```toml
version = 1
```

版本 `1` 标准化：

- `./.harness` 约定根，
- 带必需仓库本地路径的 target、有序 `[[resources]]` 源根、有序 `[[dir]]` 源根和顶级扩展声明的所选 TOML manifest schema，
- 配置过的 resources 源树，
- 由 target 派生的 override 文件夹，
- 拷贝投影（在固定输入下幂等），
- dir 组合（`.harnessComposable` 叶）和投影到相对仓库路径的文件的拷贝契约，
- `.harnessIgnore` 投影 ignore 文件，包括仓库根规则、源本地规则、profile 本地规则和目标输出本地规则，
- `.harnessMutable` 投影 mutable 文件，包括仓库根规则、源本地规则和 profile 本地规则。

在 v1 内，本文档 MAY 收到编辑性澄清和向后兼容的规范细化（例如，带定义默认值的可选字段）。会使 v1 仓库或 v1 实现失效的更改保留给 v2。

## 范围

Harness config 标准化：

- 所选 manifest 文件及其 schema，
- 配置过的 resources 源下的资源布局，
- 作为紧邻点前缀文件夹的每资源 target override，
- 带必需仓库本地路径的显式 target 声明，
- 带定义默认值的顶级激活策略，
- 有序的 dir 源根，带可组合（`.harnessComposable`）叶和投影到相对仓库路径的拷贝模式目录，
- 顶级扩展声明（仅发现和激活策略），
- 从配置过的 resources 源到声明的 target 的拷贝投影，
- `.harnessIgnore` 作为投影排除过滤器，包括目标输出排除，
- `.harnessMutable` 作为投影 mutable 文件过滤器。

声明的 target 是活动的 harness surface，不是源仓库。仓库 MAY 提交生成的 target 输出、gitignore 它们，或在保留已审阅的真理源在所选 manifest 和配置过的源根中的情况下混合提交的受管理文件与本地控件。这让团队可以在 `.agents`、`.claude`、`.cursor` 或其他 surface 中试验，而不把 runtime 编辑提升回规范源布局。

当仓库 gitignore 生成的 target 输出时，它 SHOULD 保留已跟踪的激活说明（如根指令笔记、README 设置步骤或脚本），这样新检出可以校验并重新生成那些输出。让 target 可重现的共享配置源根 SHOULD 保持跟踪；私有或试验性本地根（如 `.harness/local/`）MAY 被 gitignore（当仓库有意把它们视为开发者本地覆盖时）。

`.harnessMutable` 模型是该边界的文件级版本。它让仓库可以为 target 本地设置或状态发布一个可审阅的初始模板，同时把后续 runtime 编辑保持在规范源树之外。

### 范围之外

Harness config **不** 标准化：

- 产品工作流、命令 surface 或终端用户 UX，
- 托管服务、注册表或市场，
- 资源的分发、依赖解析或包管理，
- harness runtime 行为或 harness 如何消费 target 文件，
- 超出"带文件的文件夹"的 skill、prompt 或 rule schema，
- 选择、分组、会话、预设或工具包，
- target 到源的捕获或反向投影，
- target 编辑审阅工作流（见 [Mutable 文件](#mutable-文件) 了解基础契约），
- 远程同步、遥测或审计日志。

Harness config 是本地文件契约。该标准不要求遥测、分析、机器标识符、远程错误报告、托管服务或网络访问来校验、计划或激活仓库。

这些关注属于建立在该标准之上的工具、产品或组织策略。把它们留在 v1 之外让多个实现能在同一配置过的源树上互操作。

## 资源形状

每个 resources 源是由 manifest 中的 `[[resources]]` 条目选择的仓库本地目录。Resources 源是有序的；后续源在完全相同的逻辑投影文件路径处覆盖之前的源。缺失的 resources 源是有效的空层。资源类型（如 `skills`、`rules`、`hooks` 和 `plugins`）是每个源下的普通目录。直接文件被允许，因此仓库可以携带 target 根配置（如 `hooks.json`）而无需发明资源项文件夹。

```text
.harness/
  resources/
    hooks.json
    hooks/
      post-tool-use.sh
    skills/
      code-review/
        SKILL.md
        examples/
          checklist.md
        .claude/
          SKILL.md
    rules/
      release-policy/
        RULE.md
    plugins/
      browser-tools/
        PLUGIN.md
        .cursor/
          plugin.json
    .gemini/
      hooks.json
```

`skills`、`rules` 和 `plugins` 是约定资源类型。它们常见的 markdown 文件名是约定，不是 schema 要求。其他资源类型 MAY 在任何 resources 源下存在，无需按类型的 manifest 声明。

Resources 源下的任何目录 MAY 是可组合文件源（当它包含空 `.harnessComposable` 标记时）。目录名称是投影文件路径，其数字前缀部分按为 dir 可组合叶定义的相同 `.harnessRef` 和 `.harnessIgnore` 语义组合。匹配可组合叶逻辑输出路径的 `.harnessMutable` 规则会把组合输出文件标记为 runtime 所有；标记、部分和 `.harnessRef` 文件永远不会被单独投影。例如，`./.harness/resources/skills/review/SKILL.md/.harnessComposable` 在 `skills/review/SKILL.md` 投影一个 target 文件；该目录内的编号文件不被单独投影。资源可组合叶仍是资源：它们在声明的 target 文件夹内投影并参与资源 override、profile 和资源 ignore 规则。

直接在 resources 源下的紧邻点前缀目录是 target 根 override。对于 target `./.gemini`，约定的 `./.harness/resources/.gemini/` 下的文件覆盖该 resources 源，`.gemini` 段从输出路径中剥离。这是表示特定 target 根文件（如 `.gemini/hooks.json`）的方式。

约定资源项内的紧邻点前缀目录（如约定 resources 源下的 `./.harness/resources/skills/code-review/.claude/`）是项级 target override。它的文件覆盖该项，override 段从输出路径中剥离。

## Manifest

```toml
version = 1

[activation]
targetSymlinks = "conflict"

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.claude"

[[targets]]
path = "./runtime/agent"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"

[extensions.example]
version = 1
activation = "explicit"
```

### Resources

资源投影只使用声明的 `[[resources]]` 源根。如果未声明 `[[resources]]` 条目，资源投影被禁用。

每个 `[[resources]]` 条目 MUST 包含 `path`。工具 MUST NOT 仅因为 `[[resources]]` 条目携带为未来 v1 修订保留的未识别键而使校验失败；工具 SHOULD 将未识别键报告为信息。路径 MUST 是仓库本地，MUST 解析为仓库内部，MUST NOT 包含 `..` 段。Manifest MUST NOT 包含单个 `[resources]` 表或任何 `[resources.<kind>]` 表；资源类型保持为源树名称，不是 manifest schema 条目。

顶级资源目录名 SHOULD 使用小写字母、数字、下划线或破折号。直接在 resources 源下的点前缀名称是 target 根 override，不是共享的规范输出文件夹。资源文件和目录 MUST NOT 依赖路径遍历；所有投影输出路径 MUST 保持在它们声明的 target 内。

### Target

每个 target 都是显式的。Harness config 不保留、偏好或暗示任何 runtime target 文件夹名称。所选 manifest 中的每个 `[[targets]]` 条目声明一个仓库本地 target 路径并 MUST 包含 `path`。工具 MUST NOT 仅因为 `[[targets]]` 条目携带为未来 v1 修订保留的未识别键而使校验失败；工具 SHOULD 将未识别键报告为信息。

Target 路径 MUST 解析为仓库内部，MUST 指向仓库根下的文件夹，规范化后 MUST NOT 包含 `..` 段，MUST NOT 指向 `./.harness` 本身或它的任何后代，MUST NOT 与配置过的源根（如 `[[resources]]` 或 `[[dir]]`）重叠。

target 的 override 文件夹是前导 `./` 之后的第一个路径段，规范化为点前缀源 override 文件夹。这让 target 路径不受约束的同时保留了源树约定，即资源项内的紧邻点前缀文件夹是 override。在路径规范化（折叠重复分隔符并删除前导 `./`）后：

- `./.agents` → override 文件夹 `.agents`。
- `./.claude` → override 文件夹 `.claude`。
- `./runtime/agent` → override 文件夹 `.runtime`。
- `./.github/copilot/agents` → override 文件夹 `.github`。

两个规范化路径相等的 `[[targets]]` 条目是重复的，MUST 用诊断拒绝。

两个规范化路径以祖先和后代形式重叠的 `[[targets]]` 条目（如 `./.agents` 和 `./.agents/skills`）MUST 用诊断拒绝。Target 必须是独立的投影根。

共享第一个路径段的 target 在 v1 中有意共享一个由 target 派生的 override 命名空间。例如，`./runtime/agent` 和 `./runtime/tools` 都使用 `.runtime` override。当两个 target 需要不同 override 命名空间时，优先使用不同的第一个路径段。

Target 是配置，不是隐藏的变更。工具 SHOULD 在创建、替换、拷贝或删除文件之前显示 target 计划。

### 激活策略

可选的顶级 `[activation]` 表包含标准激活策略。当省略时，所有字段使用它们的默认值。工具 MUST NOT 仅因为 `[activation]` 携带为未来 v1 修订保留的未识别键而使校验失败；工具 SHOULD 将未识别键报告为信息。

`targetSymlinks` 控制在声明的 target 树中占据投影所需路径的符号链接：

- `"conflict"`（默认）：报告诊断并不应用，直到符号链接被手动删除或选择替换策略。
- `"replace"`：激活 MAY 删除链接本身并在该路径物化投影的拷贝输出。

在两种模式中，实现 MUST NOT 在发现、计划或应用投影时跟随 target 符号链接。

### 扩展

扩展在顶级 `[extensions.<id>]` 表下声明。扩展 id MUST 使用小写字母、数字、下划线或破折号，并 MUST 以字母开头。

每个扩展声明 MUST 包含一个正整数 `version`。这是扩展自己的配置 schema 版本，不是 Harness config 标准版本。

每个扩展声明 MAY 包含 `activation`，其值为两个值之一：

- `"explicit"`（默认）：扩展仅在用户或工具显式调用时运行。
- `"auto"`：扩展 MAY 作为工具提供的常规激活流程的一部分运行。

当省略时，`activation` 默认为 `"explicit"`。

`version` 和 `activation` 之外的字段由扩展拥有。Harness config 标准定义扩展 *发现*（工具如何看到扩展被声明）和 *激活策略*（工具是否可以在没有显式用户操作的情况下运行它）。它不定义扩展行为、输出形状、命令或兼容性规则。扩展与 Harness config 版本的兼容性属于扩展实现元数据。

工具如果遇到它未实现的扩展的 `[extensions.<id>]` 表，MUST NOT 应用该扩展的行为，MUST NOT 仅因为未知扩展而使 manifest 校验失败，并 SHOULD 把未知扩展作为信息报告，让用户决定是否安装支持。

确实实现扩展的工具 MUST 在应用该扩展的行为之前校验扩展拥有的字段。

工具在受支持的 `version` 下遇到未识别的顶级表或键时，MUST NOT 仅因此使校验失败，并 SHOULD 将其报告为信息，让作者决定是否需要更新的工具。这不改变 v1 中单数 `[resources]`、`[resources.<kind>]` 和 `[dir]` 表无效的 manifest 规则。

## 编码、路径和大小写敏感性

这些规则适用于标准读取或写入的每个文件（所选 manifest、`.harnessIgnore`、投影文件和 override 文件），除非扩展显式定义了自己的规则。

- **文本编码。** 配置文件（所选 manifest、`.harnessIgnore`）MUST 是 UTF-8。前导 UTF-8 BOM MAY 出现并 MUST 在解析时被忽略。资源文件内容按字节拷贝；标准不要求资源 payload 的任何编码。
- **行尾。** 标准不规范化行尾。投影精确拷贝字节，因此 target 文件的行尾与源匹配。
- **路径分隔符。** Manifest 和 ignore 模式使用正斜杠（`/`）。在原生分隔符不同的平台上，实现 MUST 在文件系统边界转换；用户可见的诊断 SHOULD 使用正斜杠以保证可移植性。
- **路径规范化。** 在比较之前，实现 MUST 折叠重复分隔符、删除前导 `./` 并拒绝 `..` 段。路径 MUST 解析为仓库内部。
- **大小写敏感性。** 路径比较（target 相等、override 匹配、ignore 匹配）**对大小写敏感**。可能在大小写不敏感文件系统（如默认的 macOS 或 Windows 卷）上克隆的仓库 SHOULD 避免仅大小写不同的名称，因为底层文件系统可能折叠它们。实现 MAY 在检测到此类冲突时警告。
- **符号链接。** 在配置过的源根、`./.harness` 或声明的 target 树内遇到的符号链接被视为叶文件系统条目。v1 实现 MUST NOT 在发现源树、现有 target 树、ignore、profile 或 dir 输出时跟随符号链接。当 target 符号链接占据激活需要写入的路径时，激活 MUST 报告冲突，除非选择了显式的 target 符号链接替换策略。使用该策略时，链接本身 MAY 按用于其他非目录条目的相同文件/路径冲突规则被替换。v1 不要求把符号链接保留为链接或把源符号链接投影到 target。
- **隐藏文件。** 以 `.` 开头的名称不被隐式忽略。它们像任何其他文件一样参与投影，除非被 `.harnessIgnore` 排除。这不让 Harness config 声明文件成为 target payload：`.harnessIgnore`、`.harnessMutable`、`.harnessProfile` 和 `.harnessProfileRoot` 是边界控件并 MUST NOT 被投影到 target。

## 路由资源到 target

Target 接收配置过的 resources 源树。资源类型、直接文件或子树通过目标输出本地 `.harnessIgnore` 文件从一个 target 中排除：

```text
# .claude/plugins/.harnessIgnore
*

# .cursor/prompts/.harnessIgnore
*

# .agents/checks/.harnessIgnore
local-only/
```

这是 v1 边界：

- 所选 manifest 声明 target。
- 配置过的 resources 源携带 target 资源树。
- `.harnessIgnore` 过滤源文件和目标输出子树。
- `.harnessMutable` 标记应一次性初始化 target 文件然后变为 runtime 所有的源文件。

工具 SHOULD NOT 在 v1 的所选 manifest 中引入按 target 的资源映射。把 target 声明限制为必需的仓库本地路径加被忽略的未来兼容字段，同时把源根有序地放在顶级，保留了投影过滤的单一位置，并使 dry-run 输出更易推理。

## 拷贝投影

激活是从源输入到声明的 target 的可重复拷贝投影。输入是：

1. 配置过的 resources 源下的参与文件、可组合叶和文件夹，包括它们的 override 文件夹，
2. 所选版本化 manifest，
3. `.harnessProfile` 选择器和活动的 `.harnessProfileRoot` 覆盖，
4. 所有参与的 `.harnessIgnore` 文件，包括仓库根、源本地、profile 本地和目标输出本地规则，
5. 所有参与的 `.harnessMutable` 文件，包括仓库根、源本地和 profile 本地规则，
6. 清理策略（保留未管理项 vs 删除它们），
7. mutable 策略（跳过 mutable 文件 vs 强制重新投影），
8. target 符号链接策略（冲突 vs 替换）。

**幂等性（可测试属性）。** 设 `M_n` 是声明的 target 在第 `n` 次激活后、基于上述不变输入且 target 状态除 mutable 文件字节变化外不变时的受管理投影子集。对于每个 `n ≥ 2`：

- `M_n` 中的文件集合 MUST 等于 `M_1` 中的集合，
- `M_n` 中的每个受管理（非 mutable）文件 MUST 与 `M_1` 中的对应文件字节相同，
- `M_1` 中存在的每个 mutable 文件 MUST 在 `M_n` 中仍然存在，并具有它在激活 `n − 1` 结束时所具有的相同字节（即 runtime 拥有它；激活不写入它），并且
- 不 SHOULD 发生超出收敛所需的对受管理文件的额外文件系统写入。

该属性是激活可审阅的原因：对不变输入的干净重新运行可观察为受管理文件的仅 `keep` 计划和 mutable 文件的仅 `mutable` 计划。

符合的工具 SHOULD 支持 dry run，在写入之前报告它将采取的动作：

- `create`：投影的文件在 target 中不存在。
- `update`：投影的文件存在，但字节与当前计算的投影不同。
- `remove`：target 条目被选择删除，因为它不存在于计算的投影中。
- `keep`：target 文件已经匹配投影。
- `preserve`：声明的 target 内的现有条目不在计算的投影中，将保持不变。
- `mutable`：在 `.harnessMutable` 中声明为 mutable 的文件已经存在于 target 中，即使它的字节仍然匹配源。Runtime 拥有它；激活 MUST NOT 在没有显式强制决定的情况下覆盖或删除它。

这些动作描述声明的 target 内的文件和目录。配置过的源根下的源文件是投影输入；激活不把它们分类为 `keep`、`preserve` 或 `remove`。

所有 v1 target 投影被物化为拷贝。实现 MUST NOT 要求符号链接支持以达到一致性。实现 MAY 使用内部优化，但可观察的 target 树 MUST 为校验、审阅和重复激活而表现为拷贝投影。

激活应用后，再次运行同一激活 SHOULD 对受管理文件收敛到 `keep` 动作，对声明为 mutable 的文件收敛到 `mutable` 动作。该属性保持活动 target 文件夹是派生的和可重现的，同时仍然让 runtime 拥有它们的按机器配置。

### Mutable 文件

读取活动 target 文件夹的 runtime 也可能写入它们 — 常见情况包括 `.claude/settings.local.json` 中的权限授予、允许列表的命令或学习到的 hook。Runtime 拥有的文件可以在 `.harnessMutable` 中声明为 mutable。投影在第一次激活时物化它们（动作 `create`），并在每次后续激活时把它们报告为 `mutable`，无论 target 字节是否仍然匹配源。工具 SHOULD 提供显式的强制决定，当团队需要重置 runtime 所有的状态时重新投影源字节。

Mutable 是所有权声明，不是 ignore 的同义词。被忽略的文件不进入投影。Mutable 文件在缺失时进入投影，让源树可以提供初始形状和可审阅的意图。一旦 target 文件存在，runtime 拥有它的字节，激活 MUST NOT 覆盖它，除非 mutable 策略显式强制重新投影。

在迁移期间，应为新用户存在的 mutable 文件 SHOULD 在它的路径添加到 `.harnessMutable` 之前被拷贝到配置过的源根。声明 target 文件 mutable 而无源种子只保护现有的本地文件；它不给新检出一个初始版本。

标准不分类为什么非 mutable target 文件不同于当前投影。直接拷贝实现可以把那个差异报告为 `update`。更高层产品可以在该基础契约之上添加版本控制感知的审阅、target 到源的捕获或其他工作流。

### 未管理的 target 条目

Target 文件夹可能已经包含不来自配置过的源的资源。符合的工具 MUST NOT 静默删除那些条目。它 MUST 要么保留它们，要么在删除之前要求显式的清理选择。

默认清理策略 SHOULD 是保留。当工具提供删除时，它 SHOULD 在一层总结未管理的 target 条目以保持计划可审阅：

- 对于未管理的资源项，报告项根，如 `skills/local-only`。
- 对于投影资源项内的未管理条目，报告该项内的一层，如 `skills/review/local.md` 或 `skills/review/local-assets`。
- 不展开未管理文件夹中的每个后代文件，除非用户要求更深的审计。

如果选择了清理，计划 MUST 在写入之前把那些条目显示为 `remove`。应用显式清理 SHOULD 修剪 target 内空的父目录，以便后续在不变输入下的激活在没有额外清理动作的情况下收敛。如果未选择清理，计划 MUST 把未管理条目显示为 `preserve`。

如果 target 声明从所选 manifest 中移除，核心 v1 投影不再把该 target 放在它的授权写入集中，因此在正常激活期间不清理该文件夹。要仅用基础投影契约清理 target，请在 target 仍被声明时运行清理，然后移除声明。更高层工具 MAY 保留激活状态并提供一个孤立 target 调和工作流，预览移除、忽略或捕获回源。

### 文件系统语义总结

这些规则对 v1 激活是规范的：

- 符号链接在发现源根、target 树、ignore 文件、profile 选择器或 dir 输出时从不被跟随。符号链接是叶文件系统条目。
- 当 target 符号链接占据激活需要写入的路径时，激活 MUST 报告冲突，除非所选 target 符号链接策略显式允许替换链接本身。
- 受管理 target 文件在字节不同时从当前源投影被覆盖。
- Mutable target 文件从源被创建一次，然后变为 runtime 所有，直到显式强制决定重新投影它们。
- 未管理的 target 条目被保留，除非选择了显式清理。
- 目标输出 `.harnessIgnore` 和 `.harnessProfile` 文件是受保护的本地状态，MUST NOT 被未管理清理覆盖或删除。
- 激活对 [拷贝投影](#拷贝投影) 中定义的输入是确定的。
- Target MUST NOT 指向 `./.harness`、与配置过的源根重叠或彼此重叠。

例如，`.harness/resources/hooks.json` 可以在源字节改变时更新 `.agents/hooks.json`，而被 `.harnessMutable` 匹配的 `.agents/skills/review/settings.local.json` 在第一次激活后被一次性初始化然后作为 runtime 所有的状态保持不变。像 `.claude/skills/review/.harnessIgnore` 这样的目标输出文件可以过滤该 `.claude` 子树并保持为本地 target 状态。

## Override

配置过的 resources 源中直接的点前缀文件夹是 target 根 override。约定资源项内直接的点前缀文件夹（在配置过的 resources 源下）是项级 target override。对于 target `./.claude`，override 文件夹是 `.claude`；对于 target `./runtime/agent`，override 文件夹是 `.runtime`。

投影 MUST 按以下升序优先级处理资源文件，后出现的匹配文件会在完全相同的投影路径替换较早文件：

1. 按 manifest 顺序跨 `[[resources]]` 源的规范基础资源文件，排除 target 根 override 文件夹和项级 override 文件夹。
2. 通用活动 profile 覆盖文件。
3. 按 manifest 顺序跨 `[[resources]]` 源的由 target 派生的 override 文件，包括匹配的 target 根 override 文件夹和匹配的项级 override 文件夹。输出路径会剥离 override 文件夹段。
4. 活动 profile 根内的 profile 特定 target override 文件。

Ignore 规则在每个源文件进入投影前应用，并保持为正交的最终过滤器。

当同一优先级阶段中的两个文件投影到完全相同的输出路径时，后续配置的 resources 源胜过较早源。在同一个 resources 源和阶段内，源路径字典序提供确定性的最后获胜决策。文件/目录形状冲突仍然是错误，如下所述。

Override 在文件级别合并，不是作为整目录替换。Override 文件仅当投影到完全相同的相对文件路径时替换规范文件。同级规范文件继续像往常一样投影。Override 文件 MAY 添加新文件。Override 内嵌套的点前缀文件夹（如 `.codex-plugin`）是普通输出文件夹，除非它们是紧邻的 target 根或项级 override 文件夹。

### Override 冲突

投影 MUST 在写入之前拒绝文件/目录冲突。当两个源文件投影到一个路径要求另一个路径是目录的路径时，存在冲突。

例子：

```text
# 冲突：规范文件，override 目录。
# 规范源说 "hooks" 是文件，但 override 需要
# "hooks" 是目录以便包含 config.json。
.harness/resources/skills/review/hooks
.harness/resources/skills/review/.claude/hooks/config.json

# 冲突：规范目录，override 文件。
# 规范源说 "hooks" 是目录，但 override 说
# "hooks" 本身是文件。
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/.claude/hooks

# 允许：精确文件替换
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md

# 允许：替换一个嵌套文件并保留其余
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/hooks/notify.json
.harness/resources/skills/review/.claude/hooks/config.json
```

工具 MUST 报告冲突源路径的诊断，并 MUST NOT 在冲突解决之前应用投影。

## Dir 源

每个顶级 `[[dir]]` 表声明一个 **dir 源** 是仓库本地，其内容投影到相对仓库的路径。与 resources 源不同，dir 源不作为资源树拷贝到每个 target。它们携带不被建模为资源项的持久按文件输出：顶级 agent 指令（`AGENTS.md`、`CLAUDE.md`）、按 target 配置（`.claude/settings.json`）、仓库根文件（`.gitignore`、`README.md`）和类似的一次性产物。Dir 源是有序的；后续源在完全相同的相对仓库路径处替换之前的拷贝输出，并且同一逻辑路径的可组合叶合并部分。

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

每个 `[[dir]]` 条目 MUST 包含 `path`。工具 MUST NOT 仅因为 `[[dir]]` 条目携带为未来 v1 修订保留的未识别键而使校验失败；工具 SHOULD 将未识别键报告为信息。Manifest MUST NOT 包含单个 `[dir]` 表。如果未声明 `[[dir]]` 条目，则不进行 dir 组合或拷贝。缺失的 dir 源是有效的空层。

### 可组合叶

dir 源内包含空标记文件 `.harnessComposable` 的目录是 **dir 可组合叶**。它的名称（相对于 dir 源根）是相对仓库的输出文件路径。其内匹配数字前缀模式 `<order>_<name>` 的文件是 **部分**：它们的字节按 `order` 顺序连接以产生输出文件。同一标记也可以存在于 resources 源下，但在那里它组合的是投影的资源文件而不是相对仓库的 dir 输出。

```text
.harness/dir/AGENTS.md/
  .harnessComposable           # 标记（空）
  100_intro.md                 # 部分，顺序 100
  200_rules.md                 # 部分，顺序 200

# 输出：./AGENTS.md = 100_intro.md + 200_rules.md
```

顺序前缀是非负整数。两个部分 MAY 共享同一顺序；同分通过源路径决断。可组合叶 MAY 还包含一个 `.harnessRef` 文件，其中正好一个相对仓库路径指向另一个可组合叶；该叶的展开部分在该叶的本地部分之前被导入，并按 `order` 重新排序。循环、缺失的 `.harnessRef` 目标、逃逸 dir 源根的 `.harnessRef` 目标和绝对 `.harnessRef` 目标 MUST 作为错误报告。

可组合叶 MUST NOT 包含子目录。可组合叶内的非部分、非 `.harnessRef` 文件 MUST 作为无效部分错误报告；作者要么重命名文件以匹配 `<order>_<name>`，要么移除 `.harnessComposable` 标记以切换到拷贝模式。

### 拷贝文件夹和单独文件

dir 源中不包含 `.harnessComposable` 标记的任何目录是 **拷贝文件夹**。其文件和子目录被投影并保留它们的相对路径。任何深度的单独文件也作为直接拷贝投影。

```text
.harness/dir/
  README.md                    # -> ./README.md
  .claude/
    settings.json              # -> ./.claude/settings.json
    hooks/
      post-tool-use.sh         # -> ./.claude/hooks/post-tool-use.sh
  notes/
    01_dev_intro.md            # -> ./notes/01_dev_intro.md
```

`.harnessComposable` 标记文件本身 MUST NOT 出现在任何输出中，在两种模式下都不行。

### 输出路径和 target 重叠

Dir 输出是相对仓库的路径。它们 MUST 解析为仓库内部，并且 MUST NOT 写入 `./.harness` 内部、配置过的 resources 源内部或配置过的 dir 源内部。落在声明的 `[[targets]]` 路径 **下** 的 dir 输出路径（例如当 `./.claude` 是声明的 target 时的 `.claude/settings.json`）在激活期间被合并到该 target 的投影中，因此 target 幂等性和未管理项清理尊重 dir 所有的文件。**替换或包含** 声明的 target 根本身的 dir 输出（例如当 `./.claude` 是声明的 target 时在 `.claude` 的 dir 输出）MUST 作为 `harness.dir_output_target_overlap` 报告。

不与任何声明的 target 重叠的 dir 输出路径直接写入该相对仓库路径。

### 冲突

如果两个 dir 输出会投影到不兼容的相对仓库路径（一个路径要求另一个路径同时是文件和目录），投影 MUST 报告 `harness.dir_path_conflict` 并 MUST NOT 在冲突解决之前应用。允许跨有序 dir 根的精确文件路径替换，并且同路径可组合叶合并它们的部分。

如果 dir 输出和资源投影（规范或按资源 override）会落在同一 target 内的同一路径，投影 MUST 报告 `harness.projection_path_conflict` 并 MUST NOT 应用。

### Ignore 规则

源端 `.harnessIgnore` 规则与应用于资源文件相同的方式应用于每个 dir 源内的文件，使用源路径（例如 `.harness/dir/AGENTS.md/200_skip.md` 或当 `[[dir]]` 路径是 `"./resources"` 时的 `resources/AGENTS.md/200_skip.md`）。因此嵌套的源端规则即使在 dir 源在 `./.harness` 之外时也能在 `.harnessComposable` 叶内工作。

目标输出 `.harnessIgnore` 规则也在候选输出路径已知后应用于 dir 输出。实现 MAY 使用引导阶段来计算候选 dir 输出、发现现有输出祖先目录中的 `.harnessIgnore` 文件，然后用那些规则重新计算最终输出。在 dir 收集期间仅全局 ignore 规则参与。`.harnessMutable` 仅适用于 target 资源投影；dir 输出不是 mutable target 文件。

活动的 profile 根也参与 dir 收集。Profile dir 文件夹覆盖匹配的配置过的 dir 源路径，可以添加拷贝文件或可组合部分，并可以携带抑制基础 dir 文件或基础可组合部分的逻辑 `.harnessIgnore` 文件。

## `.harnessIgnore`

`.harnessIgnore` 定义在投影资源和 dir 输出时 MUST 被忽略的文件。仓库根文件是仓库范围边界；本地文件可以为源子树或现有目标输出子树细化边界。忽略意味着完全从投影中排除。

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/resources/skills/*/metadata.toml
!.harness/resources/skills/release-notes/metadata.toml

[*]
.harness/**/tmp/

# 根规则也可以匹配目标输出路径。
.agents/**/scratch.tmp
```

根文件中的模式是相对仓库的，可以匹配源路径或目标输出路径。本地文件中的模式相对于包含该 `.harnessIgnore` 文件的目录解释。工具 MUST 支持空行、`#` 注释、`!` 否定、前导 `/` 锚点、尾随 `/` 目录模式、`*`、`**` 和 `?`。

Ignore 评估是有序的：

1. 从 `included` 开始。
2. 自上而下读取规则。
3. 匹配的非否定规则把状态改为 `ignored`；匹配的否定规则把状态改回 `included`。
4. 最后匹配的参与规则获胜。

节标题影响后续规则：

- `[*]` 或 `[global]` 把后续 ignore 规则应用于每个 target。
- `[ignore]` 把后续规则切换回 ignore 规则。
- `[mutable]` 在 `.harnessIgnore` 中不被支持。工具 MUST 报告 `harness.ignore_mutable_section_unsupported` 并 MUST NOT 把该标题下的规则当作 mutable 声明。Mutable 声明属于 `.harnessMutable`。
- 特定 target 的标题（如 `[.claude]`、`[!.cursor]` 和 `[mutable .claude]`）不被支持。工具 MUST 报告 `harness.ignore_unsupported_scope` 并 MUST NOT 应用该不支持的标题下的规则，直到出现另一个支持的节标题。

尾随 `/` 模式仅匹配目录。对于非否定 ignore 规则，它匹配目录本身和该目录的后代。对于否定规则，它只重新包含目录条目本身；后代仍然需要它们自己的否定规则，如 `!path/to/item/**`。这保留了 gitignore 风格的模式，即宽 ignore 可以关闭子树，而更深的逻辑规则有选择地重新打开一个子项。

## `.harnessMutable`

`.harnessMutable` 定义仅作为初始种子被投影的源文件。Mutable 不同于 ignore：被忽略的文件保持在投影之外，而 mutable 文件在 target 文件缺失时进入投影。一旦 target 文件存在，激活把它报告为 `mutable`，MUST NOT 覆盖它的字节，除非 mutable 策略显式强制重新投影。

```text
# .harnessMutable
.harness/**/settings.local.json
.harness/resources/skills/*/permissions.json
```

模式使用与 `.harnessIgnore` 相同的语法、本地性、否定、锚点、仅目录后缀和最后匹配获胜优先级。根文件是相对仓库的，并匹配源路径。源本地和 profile 本地文件相对于它们的逻辑源目录解释。目标输出 `.harnessMutable` 文件不属于 v1；mutable 声明属于源，不属于活动 target。

匹配资源可组合叶逻辑输出路径的 `.harnessMutable` 规则会把组合输出文件标记为 mutable。源部分仍组合初始种子，标记、部分文件和 `.harnessRef` 文件仍是声明输入，而不是投影 payload。

Mutable 评估独立于 ignore 评估有序进行：

1. 从 `not mutable` 开始。
2. 自上而下读取参与的 `.harnessMutable` 规则。
3. 匹配的非否定规则把状态改为 `mutable`；匹配的否定规则把状态改回 `not mutable`。
4. 最后匹配的参与 mutable 规则获胜。

节标题在 `.harnessMutable` 中是可选的：

- `[*]`、`[global]` 和 `[mutable]` 全局应用后续 mutable 规则。
- `[ignore]` 在 `.harnessMutable` 中不被支持；ignore 规则属于 `.harnessIgnore`。工具 MUST 报告 `harness.mutable_ignore_section_unsupported`，并 MUST NOT 应用该不支持标题下的规则，直到出现另一个受支持的节标题。
- 特定 target 的标题不被支持，原因与它们在 `.harnessIgnore` 中不被支持的原因相同。工具 MUST 报告 `harness.ignore_unsupported_scope`，并 MUST NOT 应用该不支持标题下的规则，直到出现另一个受支持的节标题。

Mutable 文件 MUST 仍然通过投影 ignore 步骤流转。如果文件既被忽略又被标记为 mutable，ignore 决定获胜，因为文件首先就不进入投影。

### 本地 `.harnessIgnore` 文件

额外的 `.harnessIgnore` 文件 MAY 出现在源位置和现有目标输出位置内。它们让资源作者或消费者把 ignore 规则保持在它们应用到的文件附近，而不臃肿根文件。

额外的 `.harnessMutable` 文件 MAY 出现在源位置和 profile 根内。它们让资源作者把仅初始化所有权规则保持在它们影响的源模板文件附近。

```text
.harnessIgnore                                  # 根文件
.harnessMutable                                 # 根 mutable 文件
.harness/resources/skills/review/.harnessIgnore           # 源本地资源规则
.harness/resources/skills/review/.harnessMutable          # 源本地 mutable 规则
.harness/resources/skills/review/.claude/.harnessIgnore   # 源本地 override 规则
.harness/resources/skills/review/.claude/.harnessMutable  # 源本地 override mutable 规则
resources/AGENTS.md/.harnessIgnore              # 源本地自定义 dir 规则
.agents/skills/review/.harnessIgnore            # 目标输出本地规则
notes/.harnessIgnore                            # dir 输出的目标输出规则
```

以下规则适用：

- **源本地规则。** `./.harness` 下、配置过的 resources 源下或配置过的 dir 源下的 `.harnessIgnore` 文件匹配源路径。默认路径文件 `.harness/resources/skills/review/.harnessIgnore` 中的模式如 `*.tmp` 匹配 `.harness/resources/skills/review/scratch.tmp` 和 `.harness/resources/skills/review/nested/scratch.tmp`，但不匹配 `.harness/resources/skills/triage/scratch.tmp`。
- **源本地 mutable 规则。** `./.harness` 下或配置过的 resources 源下的 `.harnessMutable` 文件以相同的本地性匹配源路径。它把匹配的投影资源文件标记为只初始化的 mutable 文件。Dir 输出不是 mutable target 文件。
- **目标输出本地规则。** 现有声明的 target 根下的 `.harnessIgnore` 文件匹配目标输出路径。`.agents/skills/review/.harnessIgnore` 中的模式如 `*.tmp` 匹配输出路径 `.agents/skills/review/scratch.tmp`，无论源是 `.harness/resources/skills/review/scratch.tmp` 还是 override 文件。对于 dir 输出，实现还在候选输出路径的现有祖先目录中发现 `.harnessIgnore` 文件，例如对输出 `notes/release.md` 的 `notes/.harnessIgnore`。
- **target 本地控件。** 目标输出 `.harnessIgnore` 文件是活动 harness surface 的本地控件，对临时开发偏好、特定机器排除或开发者需要把本地 runtime 文件保持在下次激活之外的 gitignored target 文件夹有用。它们调整输出边界而不把 target 文件夹变为源根。共享或首次激活规则应在仓库根或源本地 `.harnessIgnore` 文件中。
- **影响范围。** 本地文件仅在候选源路径或目标输出路径在该文件目录内时参与。
- **评估顺序。** 规则集按阶段评估：根文件第一，然后源本地和 profile 本地文件按逻辑目录深度递增顺序，然后目标输出本地文件按逻辑目录深度递增顺序。在每个规则集内，规则自上而下读取。所有文件中最后匹配的参与规则获胜。因此更深的源或 target 文件可以重新包含更浅文件在同一阶段排除的路径，或排除更浅文件本应包含的路径。目标输出本地规则形成 target 子树的最终输出边界，profile 本地源规则不能撤销它。
- **逻辑位置。** 每个参与的本地 `.harnessIgnore` 都有逻辑位置。Profile 本地文件在 profile 根的逻辑覆盖位置参与。由 target 派生的 override 文件在它们的逻辑源和 target 位置参与，而不仅在存储 override 的物理点文件夹中参与。
- **相同语法。** 嵌套文件支持与相应根文件相同的注释、否定、锚点、glob 语法和支持的节标题。
- **特定 target 放置。** 目标输出子树内的嵌套 `.harnessIgnore` 是特定 target 的机制。特定 target 的节标题即使在 override 文件夹内也无效。
- **合成 ignore。** 每个 `.harnessIgnore`、`.harnessMutable`、`.harnessProfile` 和 `.harnessProfileRoot` 文件本身被排除在投影之外，相当于声明文件的全局 ignore 规则。实现 MUST NOT 把这些声明文件拷贝到 target 中，即使没有显式规则排除它们。目标输出声明文件仍然可以从其现有 target 位置影响投影；它作为本地控件读取，而不作为受管理的 target 内容投影。
- **目标输出保护。** 已经存在于目标输出位置的 `.harnessIgnore` 文件 MUST NOT 被投影覆盖，MUST NOT 被未管理清理删除。保持该文件在原位所需的祖先目录也 MUST 被保留。现有目标输出 `.harnessProfile` 文件具有相同保护。

本地文件是可选的范围边界输入；仅使用根文件的仓库保持符合。目标输出本地文件仅在它们存在于磁盘上后参与；实现不必推断尚未创建的文件的内容。

## Profile 覆盖

Profile 覆盖是由 `.harnessProfile` 文件选择的可选源覆盖。`.harnessProfile` 文件是 UTF-8 文本。在修剪每行的空白并忽略空白行后，它 MUST 包含零或一个 profile 名称。零个 profile 名称为该输出子树选择没有 profile。多于一个非空行 MUST 产生错误，并且该选择器 MUST NOT 参与投影。仓库根 `.harnessProfile` 全局应用；目标/输出本地 `.harnessProfile` 应用于它的目录和后代，对于任何输出路径，最近的选择器获胜。每个输出路径一次最多只有一个活动 profile，虽然不同 target 或 dir 输出子树可以通过更近的目标/输出本地选择器选择不同 profile。

Profile 内容由 `.harnessProfileRoot` 声明，它 MUST 住在 `./.harness` 下、配置过的 resources 源下或配置过的 dir 源下。`.harnessProfileRoot` 文件是 UTF-8 文本。在修剪每行的空白并忽略空白行后，它 MUST 包含正好一个 profile 名称。零个 profile 名称或多于一个非空行 MUST 产生错误，该 profile 根 MUST NOT 参与投影。`.harnessProfileRoot` MUST NOT 嵌套在另一个 profile 根内。包含 `.harnessProfileRoot` 的目录是 profile 根。它是源存储，不是资源项，MUST NOT 作为 skill、rule、plugin、dir 输出或拷贝的声明文件投影。

Profile 根根据放置标记的位置覆盖源路径：

- 如果标记目录是配置过的 resources 源或配置过的 dir 源的紧邻子目录，该标记目录覆盖该源根。例如，在约定 resources 路径下，`.harness/resources/deploy/.harnessProfileRoot` 覆盖 `.harness/resources`；`deploy/` 的子项变为逻辑资源输出。
- 如果标记目录嵌套在配置过的 resources 源或配置过的 dir 源更深处，该标记目录覆盖它的父目录。这让资源项可以携带可移植本地 profile。例如，在约定 resources 路径下，`.harness/resources/skills/example/aggressiveProfile/.harnessProfileRoot` 覆盖 `.harness/resources/skills/example`，因此在该 profile 活动时 `.harness/resources/skills/example/aggressiveProfile/SKILL.md` 替换逻辑 `.harness/resources/skills/example/SKILL.md`。
- 否则，`./.harness` 下的标记目录覆盖 `./.harness`。这支持工具包布局，如 `.harness/kits/deploy-kit/.harnessProfileRoot`，其子项如 `resources/` 和 `dir/`。

在投影期间，profile 覆盖参与 [Override](#override) 中定义的资源优先级顺序。因此通用 profile 覆盖不能替换特定 target 的 override（如 `.codex`）；特定 profile 的 `.codex` override 可以。如果所选 profile 的多个活动 profile 根投影同一逻辑文件，工具 MUST 按 profile 根路径使用确定性的最后获胜顺序，并 SHOULD 报告警告。Profile 本地 `.harnessIgnore` 和 `.harnessMutable` 文件匹配逻辑覆盖路径，不是存储路径。例如，在 `.harness/profiles/personal/dir/AGENTS.md/.harnessIgnore` 的 ignore 文件就像它位于 `.harness/dir/AGENTS.md/.harnessIgnore` 一样应用，因此它可以在添加 profile 部分之前抑制基础可组合部分。

作为 profile 根的物理祖先的源本地 `.harnessIgnore` 文件也在 profile 根映射到其逻辑覆盖路径之前应用。例如，`.harness/kits/.harnessIgnore` 可以排除活动 `deploy` profile 中的 `.harness/kits/deploy/**/.harness-cache/` 元数据，即使该 profile 根下的文件覆盖逻辑路径（如 `.harness/resources` 或 `.harness/dir`）。

对于 dir 源，实现 MUST 使用引导/最终流程：用源端规则和任何已知的 profile 选择器收集候选输出，在候选输出祖先中发现目标输出 `.harnessIgnore` 和 `.harnessProfile` 文件，然后重新计算最终输出。活动的 profile 目录 MUST 也参与候选发现，以便目标输出 `.harnessProfile` 可以激活仅 profile 的 dir 输出，即使没有基础 dir 源会产生该输出。活动的 profile 目录可以贡献到现有的 `.harnessComposable` 叶，即使 profile 目录不重复 `.harnessComposable` 标记。

## 可审阅性

源/投影边界使跨 surface 的差异可审阅：

- 配置过的 resources 源下的差异影响投影该资源路径的每个 target。
- 资源项内的 `.agents`、`.claude`、`.cursor` 或其他 override 文件夹下的差异只影响使用该 override 的 target。
- 仓库根 `.harnessIgnore` 中的差异全局更改投影排除边界；嵌套 `.harnessIgnore` 中的差异只在该文件的源或目标输出目录内更改投影。
- `.harnessMutable` 中的差异更改哪些投影的源文件变为只初始化的 runtime 所有的 target 文件。
- 现有目标输出 `.harnessIgnore` 中的差异更改将被拷贝到该输出子树的内容，而不把 target 文件夹变为真理源。
- `.harnessProfile` 中的差异更改哪些 profile 根覆盖应用于该输出子树；活动 `.harnessProfileRoot` 下的差异仅更改选择该 profile 的输出。
- 所选 manifest 中的差异更改资源源路径、target 路径、dir 设置和扩展声明。

## 安全要求

- 校验 MUST 是只读的。
- 路径 MUST 保持在仓库内部。
- 初始化命令 MUST 在变更之前解释计划的文件系统更改。
- 激活命令 SHOULD 提供 dry run 并在变更之前解释创建、更新、删除、保留、未管理保留项和 mutable 跳过。
- 工具提供的只读路径自省，MUST 从与激活相同的 [拷贝投影](#拷贝投影) 中定义的输入派生。
- 活动 harness surface MUST 被视为投影 target，不是源仓库。
- 团队 MAY gitignore 活动 harness surface，因为它们是生成的输出；这样做不改变真理源或 target 声明契约。
- gitignore 活动 harness surface 的仓库 SHOULD 保留已跟踪的激活说明，SHOULD NOT gitignore 重新生成那些 surface 所需的共享配置过的源根。开发者本地源根 MAY 被 gitignore，当它们有意在共享真理源之外时。
- 激活 MUST 对 [拷贝投影](#拷贝投影) 中定义的相同输入幂等。
- 投影 MUST 遵守 `.harnessIgnore`，使日志、元数据、缓存和实现状态保持在活动 harness surface 之外。
- 工具 MUST 在存在时合并由 target 派生的 override，并在没有 override 时回退到规范文件。
- 未知资源类型 MAY 作为配置过的 resources 源下的目录使用。
- Mutable 文件 MUST 在第一次投影时被创建，MUST 在后续投影时被跳过，除非用户显式选择强制重新投影。

## 安全考虑

Harness config 描述一个系统，把文件从版本控制拷贝到 AI agent 或其他工具随后将读取的文件夹。这些拷贝的完整性直接影响 agent 做什么。实现 SHOULD 显式考虑以下威胁：

- **路径遍历。** Manifest 路径、target 路径和 ignore 模式由用户控制。实现 MUST 拒绝在规范化后解析到仓库外的路径（见 [编码、路径和大小写敏感性](#编码-路径和大小写敏感性)）。
- **符号链接重定向。** 源树中或声明的 target 树中的符号链接如果被跟随可以把读取或写入重定向到仓库外。v1 实现 MUST 把符号链接视为叶条目，MUST NOT 静默跟随它们。替换占据投影路径的 target 符号链接 MUST 要求显式的 target 符号链接策略，无论来自所选 manifest 还是来自等效的操作员选择的激活选项。
- **应用时的 TOCTOU。** Target 可能在计划和应用之间被修改。实现 SHOULD 在应用时重新检查文件存在和受管理/未管理分类，而不仅在计划时。
- **未管理项删除。** 清理删除用户文件。默认策略 MUST 是保留，任何删除 MUST 在它发生之前在计划中可见。
- **Mutable 绕过。** `.harnessMutable` 规则是显式的"runtime 在第一次投影后拥有此"声明。实现 MUST NOT 在没有显式、用户可见的强制决定的情况下覆盖 mutable target。
- **不可信 override。** 仓库可能从第三方导入资源项。因为 override 文件夹可以重写任意 target 文件，实现和下游产品 SHOULD 提供工具来对比 override 文件夹与规范文件并限制给定 override 可以影响的 target。
- **读取自己输出的激活。** 活动 target 文件夹 MUST NOT 被用作下次投影的输入。把 target 同时作为源和槽可以静默地把 runtime 编辑放大为真理源更改。

标准不为资源文件夹规定身份验证、签名或供应链验证。这些是产品层和组织策略的适当关注。

## 兼容性和未来演进

在 v1 内，允许以下种类的更改，不需要新的标准版本：

- 不改变规范含义的编辑性澄清。
- 带定义默认值的新可选字段，保留省略它们的 v1 文档的含义。
- 新的扩展声明（按定义是 opt-in）。
- `[[resources]]`、`[[targets]]` 或 `[[dir]]` 条目中的新可选字段，受未知键规则约束。
- 在旧工具可以安全忽略时，受未知字段规则约束的新未识别顶级表或键。
- 额外的诊断或非阻塞警告。

以下更改保留给 v2：

- 任何对 target 的 manifest schema 或顶级 `version` 字段的更改，会使 v1 manifest 失效。
- 任何对投影语义（`create`、`update`、`remove`、`keep`、`preserve`、`mutable`）的更改，会改变不变 v1 输入的磁盘上结果。
- 任何对 `.harnessIgnore` 语法或优先级的更改，会改变现有 v1 规则集包含、排除或标记为 mutable 的文件。
- 保留先前对用户仓库可用的资源类型或 target 名称。

实现 SHOULD 把 `version` 是正整数但大于它们支持的最大值的 manifest 视为"不支持版本"诊断，而不是格式错误的 manifest。这让不支持的未来 manifest 对旧工具有信息地失败。
