---
title: 一致性
seoTitle: Harness config 一致性
socialTitle: Harness config 工具的可测试一致性声明
description: 面向仓库、资源、target、投影、路径自省和工具的可测试声明。
socialDescription: 实现 Harness config 规范的仓库和工具的一致性标准。
canonicalPath: /specifications/v1/conformance/
slug: conformance
order: 6
locale: zh-cn
sectionCode: "06"
summary: 面向仓库、资源、target、投影、路径自省和工具的可测试声明。
llmSummary: 列出仓库形状、资源路径、投影、override、ignore、扩展、激活和路径自省的可测试一致性预期。
audience: 校验 Harness config 兼容性的测试作者和实现者。
contentKind: spec
status: draft
updated: 2026-05-28
---

# Harness config 一致性

Harness config 支持的声明应该从文件形状和激活契约本身可测试。仓库、工具或组织策略可以在以下相关检查可以在不依赖特定 runtime、CLI 或托管服务的情况下被重现时声明支持。

## 一致性级别

- 仓库一致性：仓库在所选仓库本地 manifest 中声明 `version = 1`、把每个声明的路径保持为仓库本地，并在配置过的 resources 源下存储持久 target 资源。
- 资源一致性：资源是配置过的 resources 源下的文件或文件夹。约定资源项是 `<resources>/<kind>/<name>` 下的文件夹。Target 根 override 表现为直接在 resources 源下的点前缀文件夹；项 override 表现为直接在约定项内的点前缀文件夹。资源文件也可以从标记为 `.harnessComposable` 的目录组合。
- Target 一致性：`[[targets]]` 条目包含必需的仓库本地路径，并且可以携带工具作为信息处理的未来兼容未识别字段。匹配的 override 文件夹从第一路径段推断。没有 target 可以指向 `.harness`、与配置过的源根重叠或重新声明资源映射。
- Dir 一致性：每个 `[[dir]]` 表声明一个有序的仓库本地 dir 源根。该源内标记为空 `.harnessComposable` 文件的目录是可组合叶，其数字前缀部分连接成一个输出文件；所有其他目录和文件按原样拷贝到匹配的相对仓库路径。这些输出与投影到每个 target 的资源项分开。
- 扩展声明一致性：`[extensions.<id>]` 表包含正整数 `version`，可以将 `activation` 设置为 `explicit` 或 `auto`，并把所有其他字段留给扩展实现。
- 投影一致性：激活应用 `.harnessIgnore` 排除和 `.harnessMutable` 仅初始化所有权规则，包括适用时的源本地、profile 本地和目标输出本地 ignore 文件，区分忽略文件与 runtime 所有的 mutable 文件，把每个声明的 target 视为拷贝投影，并对相同的输入、清理策略和 mutable 策略产生相同的 target 树。
- 工具一致性：实现在写入之前报告激活计划，列出创建、更新、请求的删除、保留的文件、保留的未管理项和 mutable 跳过的文件，并从不把活动 target 文件夹作为真理源读取。当工具提供路径自省时，该解释是只读的，并从与激活相同的所选 manifest、配置过的源根、profile 选择器、ignore 规则、mutable 规则、mutable 策略和投影模型派生。

## 仓库检查清单

- 所选 manifest 存在并声明 `version = 1`。
- 持久 target 资源住在配置过的 resources 源下。
- 约定资源项住在 `<resources>/<kind>/<name>` 下；直接资源文件（如 `.harness/resources/hooks.json`）在任何配置过的 resources 源下都被允许。
- 资源可组合叶使用以投影文件命名的目录、空 `.harnessComposable` 标记和数字前缀部分。
- 由 target 派生的 override 仅作为直接在 resources 源下或直接在约定资源项内的点前缀文件夹出现。
- `[[targets]]` 条目包含必需的仓库本地路径；未识别键是信息，不是错误。
- 没有 target 重新定义资源、模式或 override 名称。
- 没有 target 指向 `./.harness`。
- 声明扩展时扩展 id 和核心扩展字段校验通过。
- `.harnessIgnore` 模式是相对仓库的并能干净地解析。
- 全局 ignore 节（如 `[*]` 和 `[global]`）被识别。
- `.harnessMutable` 模式被识别并标识源投影可以在 runtime 拥有 target 字节之前初始化一次的文件。
- 如果声明了 `[[dir]]` 条目，每个 dir 源根解析为仓库本地，每个可组合叶携带 `.harnessComposable` 标记。Dir 源下的拷贝文件夹和单独文件不携带标记。

## 实现要求

- `./.harness` MUST 被视为约定仓库源层，不是应用工作区或必需的 manifest 位置。
- 资源类别 MUST 被视为源树名称。`skills`、`rules`、`hooks` 和 `plugins` 是常见约定，不是必需的 schema 类别。
- 常见约定之外的资源类型 MAY 在住在配置过的 resources 源下并遵循相同 override 契约时使用。
- 资源可组合叶 MUST 在叶路径作为一个文件投影，MUST NOT 单独投影它们的标记、`.harnessRef`、`.harnessIgnore`、`.harnessMutable` 或编号部分文件。
- Override MUST 从 target 路径派生。
- 所选 manifest MUST 在 target 条目中保留必需的 `path`，并把未来兼容的未识别键作为信息容忍。Target MUST NOT 重新定义资源、模式或 override 名称。顶级 `[[resources]]` 和 `[[dir]]` 表声明有序源根。
- 激活 SHOULD 从投影派生。
- 激活 MUST 对 [Standard](/specifications/v1/standard/#拷贝投影) 中定义的规范输入幂等。
- 实现 MUST NOT 在发现配置过的源根、声明的 target 树、ignore 文件、profile 选择器或 dir 输出时跟随符号链接。
- 实现 MUST 在符号链接占据投影路径且所选 target 符号链接策略为 `conflict` 时报告 target 符号链接冲突。实现 MAY 仅当所选策略为 `replace` 时替换链接本身。
- 实现 MUST 在 target 字节与计算的源投影不同时把受管理 target 文件报告为更新，应用激活 MUST 写入当前源投影。
- 实现 MUST 默认保留未管理的 target 条目，并 MUST 在删除之前要求显式清理选择。
- 实现 MUST 支持 `.harnessIgnore` 用于保持在活动投影之外的根、源本地、profile 本地、由 target 派生的 override 和目标输出本地文件。优先级 MUST 使用逻辑位置和逻辑目录深度，最后匹配参与规则获胜。Profile 本地文件 MUST 在 profile 覆盖位置评估，由 target 派生的 override 文件 MUST 在它们的逻辑源和 target 位置评估，已经存在的目标输出 `.harnessIgnore` 文件 MUST 保持为最终边界并在激活和未管理清理期间被保留。
- 实现 MUST 支持 `.harnessProfile` 选择器和 `.harnessProfileRoot` 覆盖。Profile 根 MUST 住在 `./.harness`、配置过的 resources 源或配置过的 dir 源下，MUST 作为普通资源项被跳过，MUST 为资源和 dir 输出按逻辑源路径合并。
- 实现 MUST 支持 `.harnessMutable` 并把匹配文件视为一次创建、runtime 所有的 target 文件，即使 target 字节仍然匹配源模板。匹配资源可组合叶逻辑输出路径的 `.harnessMutable` 规则 MUST 把组合输出文件标记为 mutable。这种行为与 ignore 行为分离：被忽略的文件保持在投影之外，而 mutable 文件可以在缺失时被投影并在创建后被保留。
- 声明的 target 文件夹 MUST 被视为投影输出，不是源仓库。
- 声明的 target 文件夹 MUST NOT 指向 `./.harness`、与配置过的源根重叠或彼此重叠。
- 当声明了 `[[dir]]` 条目时，激活 MUST 从其数字前缀部分组合每个带 `.harnessComposable` 标记的目录，并 MUST 把每个 dir 源下的每个其他目录和文件拷贝到匹配的相对仓库路径。落在声明 target 下的 dir 输出路径 MUST 被合并到该 target 的投影中；会替换或包含声明 target 根的 dir 输出路径 MUST 被拒绝。Dir 源内的源本地 `.harnessIgnore` 文件（包括 `.harness` 之外的自定义 dir 源）MUST 过滤 dir 源文件。目标输出 `.harnessIgnore` 文件 MAY 在候选输出已知后按最终输出路径过滤 dir 输出。目标输出 `.harnessProfile` 文件 MAY 在候选输出已知后为 dir 输出选择 profile 覆盖。

## 证据

仓库证据是版本化 manifest、共享的配置过的源树、`.harnessIgnore` 和声明 mutable 文件时在版本控制中可见的 `.harnessMutable`。当生成的活动 harness surface 被 gitignored 时，仓库证据还应包括解释如何校验和重新生成那些 surface 的已跟踪激活说明。使用时，profile 证据是所选 `.harnessProfile` 文件和配置过的源根下匹配的 `.harnessProfileRoot` 文件夹。

工具证据是在任何写入之前列出创建、更新、请求的删除、保留的文件、mutable 跳过的文件和保留的未管理项的 dry-run 报告。

投影证据是对不变输入的两次连续激活，它们对受管理文件产生字节相同的 target 树，并在第一次应用后让 mutable 文件保持不变。

Mutable 证据应显示所有权过渡：第一次应用从源创建声明的 mutable 文件，runtime 编辑更改 target 字节，后续激活在不覆盖文件的情况下把文件报告为 mutable。

策略证据是在贡献者本地使用的相同规则下运行校验的 CI 步骤。

隐私证据简单：校验、计划和激活可以从仓库文件演示，不需要遥测、分析、远程错误报告或网络访问。

## 诊断代码

符合的工具 SHOULD 与人类消息一起报告机器可读的诊断代码。v1 代码目录在 [`docs/DIAGNOSTICS.md`](https://github.com/reachjalil/harness-config/blob/main/docs/DIAGNOSTICS.md) 中维护。发出 `harness.*` 代码的工具 MUST 使用该目录中的代码。工具 MAY 在它们自己的命名空间（例如 `my-tool.*`）中为标准之外的条件发出代码。
