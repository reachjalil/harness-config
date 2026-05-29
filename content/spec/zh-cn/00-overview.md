---
title: 概览
seoTitle: Harness config 概览
socialTitle: 一种为 harness surface 设计的中立源布局
description: 一个本地源布局和激活模型，用于跨 runtime、团队、profile、本地控件和 runtime 所有的可变文件的高级、可预测的 harness surface 配置。
socialDescription: 概览 .harness 如何利用本地 dry-run 激活、投影边界、profile 覆盖、目标本地控件、runtime 所有的可变文件、无遥测工具和显式目标，让 agent 配置在不变得隐式的同时变得更强大。
canonicalPath: /specifications/v1/
slug: overview
order: 0
locale: zh-cn
sectionCode: "00"
summary: 源布局、本地激活模型、投影控件、runtime 所有的可变文件、profile 覆盖、目标本地控件、无遥测工具和操作收益的一次性介绍。
llmSummary: 介绍 .harness 作为仓库所有的 agent 配置源目录，包含本地 dry-run 激活、无遥测工具、可组合的指令文件、profile 覆盖、runtime 所有的可变文件、目标本地控件和显式 runtime 投影，使高级配置可预测、可审阅、可复用。
audience: 评估仓库本地 agent 配置的技术读者和实现者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# 一种为 harness surface 设计的中立源布局

Harnesses 暴露的是活动文件和文件夹，比如 `AGENTS.md`、`.agents`、`.claude`、`.gemini` 和 `.cursor`。这些是有用的 harness surface，但当多个工具需要同样的 skills、rules、plugins 和指令文件时，它们是脆弱的真理源。

Harness config 把可复用的 agent 资源保留在仓库所有的源根中，按惯例置于 `.harness` 下，把每个 harness surface 的输出声明为显式 target，并通过 dry-run 优先的拷贝投影来物化每个 target。有序的源根让一个项目可以在保持已审阅源稳定的前提下叠加共享配置与可选的本地定制。

核心思想是所有权边界。规范的 prompts、skills、rules、hooks 和指令片段是仓库所有的源。活动的 harness surface 是生成的输出。在 `.harnessMutable` 中声明的文件从源初始化一次，然后成为 runtime 所有的目标状态，用于设置、权限、学习到的命令和其他应在后续激活中保留的本地数据。

隐私模型从同一份文件契约推出：验证、计划和激活都在仓库的本地文件上运行；标准不需要遥测、分析、托管服务或网络访问。

## 为什么激活重要

激活是该标准的运营收益。它把分散在多个活动文件夹中的 agent 配置变成一个可重复的投影步骤：读取源目录，应用 profile 和针对特定 target 的差异，过滤边界，预览计划，然后只有在审阅后才写出普通文件。

那个边界在不把 `.harness` 变成一个完整产品平台的情况下提供了有用的副作用。CI 可以校验开发者本地使用的同一份 manifest。编辑器可以预览一个 harness 将收到什么。审阅工具可以显示哪些 target 文件被创建、更新、保留或有意保留为 mutable。多个 harness 可以消费同一个源资源，而不把任何一个 harness surface 视为规范格式，同时每个 runtime 可以保留它自己的 mutable 状态。

结果不是围绕 agent 配置的更多仪式，而是更少的隐藏状态：一个小标准，让激活可解释、可重复并足够安全可被自动化。

## 高级配置，可预测的形状

该标准在不让激活变得不透明的同时支持有表达力的配置。Profile 允许团队、开发者或 target 子树选择一个配置层。`[[dir]]` 组合允许从已审阅的部分组装共享的指令文件。目标输出中的 `.harnessIgnore` 和 `.harnessProfile` 文件允许活动的 harness surface 保留本地控件而不把这些控件提升回规范源。

这些功能有意地间接。它们不要求每个工具发明新的设置 UI、注册表或同步服务。它们给工具一个稳定的、可被检查的文件契约：哪些源存在、哪个 profile 活动、哪个 target 收到哪个投影、什么被过滤、什么会在清理时被保留。

那就是该标准的核心价值：高级可配置性配合可预测的激活计划。平台团队可以发布安全或部署工具包。项目可以从共享部分组合 `AGENTS.md`。开发者可以保留一个本地 target 偏好。CI job 仍然可以在任何写入之前从仓库的文件中解释同一结果。

## 它做什么

Harness config 回答四个实际问题：

- **持久的 agent 配置住在哪里？** 在配置过的源根中，默认在 `.harness/` 下，而不是在一个工具也可能写入的 harness surface 中。
- **哪些活动文件夹接收生成的文件？** 只有在所选 manifest 中作为 `[[targets]]` 声明的路径，manifest 默认为 `./.harness/harness.toml`。
- **什么被允许跨越投影边界？** `.harnessIgnore` 文件可以按源路径和按最终输出路径过滤。
- **runtime 可以拥有哪些 target 文件？** `.harnessMutable` 规则将文件初始化一次，然后把活动 target 的字节作为 runtime 所有的状态保留。
- **团队如何安全地变化输出？** 由 target 派生的 override 处理 runtime 差异；profile 覆盖处理团队工具包、个人定制和 target 本地变体。
- **本地变化如何保持可问责？** target 输出 profile 和 ignore 作为活动控件被保留，激活仍然在写入前报告计算出的计划。

## 该标准定义了什么

- 所选 manifest（默认 `./.harness/harness.toml`）声明标准版本、有序 `[[resources]]` 源、有序 `[[dir]]` 源和显式 `[[targets]]`。
- 资源文件夹住在配置过的 resources 源下，常见路径如 `.harness/resources/skills/<name>` 或仓库在那里携带的任何自定义目录。一个 resources 源中的 `.harnessComposable` 叶为每个声明的 target 组合出一个被投影的资源文件。
- 由 target 派生的 override 文件夹（如 `.claude` 或 `.agents`）住在资源内部，只在匹配的 target 被投影时合并。
- `.harnessIgnore` 文件定义投影边界。仓库根文件可以匹配源路径和输出路径。源本地文件跟随源路径。目标输出本地文件跟随最终输出路径并在清理期间被保留。
- `[[dir]]` 源与 resources 分离；它们把 `.harnessComposable` 叶组合成相对仓库的输出（如 `AGENTS.md`），或把文件复制到相对仓库的输出路径。
- `.harnessProfile` 选择活动 profile。`.harnessProfileRoot` 声明在 `.harness` 或配置过的源根下的 profile 覆盖根。活动覆盖可以添加或重写资源和 dir 可组合部分，而不把 profile 文件夹变成普通投影项。

## 为什么它有帮助

完整目录在一个地方可审阅。Harness surface 仍然是普通的活动文件和文件夹，团队选择时它们可以被重新生成、清理或由 Git 忽略。那种灵活性对实验有用：开发者可以尝试本地 harness 设置、scratch 文件或 runtime 状态而不把那些编辑变成共享源。Mutable 文件模型把这种区分显式化，而不是依赖约定或隐藏的产品状态。

ignore 和 profile 控件之所以重要，是因为真实仓库有本地变化。一个团队可能希望 `.claude` 排除一个生成的 scratch 文件，而 `.agents` 保留它。一个开发者可能希望有个人 `AGENTS.md` 前言而不更改团队指令。一个平台团体可能发布一个 deploy 工具包，只在被选择时贡献 skills 和指令片段。这些工作流需要精确的输出控制，而不是另一个隐藏在 harness surface 中的源树。

## 激活流程

1. 解析所选 manifest 和配置过的源根。
2. 发现 `.harnessProfile` 选择器和活动的 `.harnessProfileRoot` 覆盖。
3. 从源资源、profile 覆盖和匹配的 target override 构建 target 投影。
4. 用每个规则集的正确源路径或输出路径，应用根、源本地、profile 本地和目标输出 `.harnessIgnore` 规则。
5. 组合或复制 dir 输出，并合并落在声明 target 下的输出。
6. 在写入前预览创建、更新、mutable 跳过、删除、保留和未管理的保留项。

重要约束是单向所有权：`.harness/` 是规范的，活动 target 是生成的输出，目标输出声明文件（如 `.harnessIgnore` 和 `.harnessProfile`）是受保护的本地控件而不是投影的源文件，`.harnessMutable` 文件在它们的第一次投影后由 runtime 所有。

## 开放提议

Harness config 作为开放规范提议被开发。来自真实仓库、runtime 作者和工具构建者的反馈在边界仍然小到可以推理时特别有用。

使用 [`reachjalil/harness-config`](https://github.com/reachjalil/harness-config) 仓库提问、提 issue、做兼容性说明、给例子和 pull request。
