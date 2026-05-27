---
title: 概览
seoTitle: .harness config 概览
socialTitle: 面向智能体 harness 配置的中立源层
description: 面向跨 runtime、团队、profile 和本地控制的高级、可预测智能体 harness 配置源布局与激活模型。
socialDescription: 概览 .harness 如何通过 dry-run 激活、投影边界、profile overlay、本地目标控制和显式目标，让智能体配置更强但不隐式。
canonicalPath: /specifications/v1/
slug: overview
order: 0
locale: zh-cn
sectionCode: "00"
summary: 源布局、激活模型、投影控制、profile overlay、本地目标控制和操作价值。
llmSummary: 介绍 .harness 作为仓库拥有的智能体配置源目录，提供 dry-run 激活、可组合指令、profile overlay、本地目标控制和显式 runtime 投影。
audience: 评估仓库本地智能体配置的技术读者和实现者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# 面向 harness surface 的中立源层

Harness 会暴露 `AGENTS.md`、`.agents`、`.claude`、`.gemini` 和 `.cursor` 这样的实时文件和文件夹。这些 harness surface 很有用，但当多个工具需要同一组 skills、rules、plugins 和指令文件时，它们不是稳定的事实来源。

Harness config 把可复用资源保存在配置过的仓库源目录中，约定放在 `.harness` 下；每个 harness surface 输出都必须显式声明为目标；激活时先 dry-run 预览，再通过复制投影写入目标。

## 为什么激活重要

激活把分散的实时文件夹变成可重复的投影步骤：读取源目录，应用 profile 和目标差异，过滤边界，预览计划，然后只在审查后写入普通文件。

这种边界让 CI 可以验证开发者本地使用的同一 manifest。编辑器可以预览每个 harness 将收到什么。审查工具可以说明哪些目标文件会被创建、更新、保留或作为 mutable 留给 harness。

## 可预测的形状

该标准支持高级配置，但不让激活变得不透明。Profile 选择配置层；`[dir]` 从可审查片段组合共享指令；目标输出中的 `.harnessIgnore` 和 `.harnessProfile` 保留本地控制，但不会把这些控制提升为规范源。

## 定义内容

- 选中的 manifest，默认 `./.harness/harness.toml`，声明版本、资源源、可选 `[dir]` 源和 `[[targets]]`。
- 资源位于配置的资源源下，默认 `.harness/resources`。资源源中的 `.harnessComposable` 叶子会为每个声明目标组合一个投影资源文件。
- `.claude` 或 `.agents` 等目标派生覆盖位于资源内部，只在匹配目标时合并。
- `.harnessIgnore` 定义投影边界。
- `[dir]` 与资源分开；它把 `.harnessComposable` 叶子组合成仓库相对输出，或把文件复制到仓库相对路径。
- 激活在写入前报告计算出的计划。

## 开放提案

Harness config 正以开放规范提案的方式推进。来自真实仓库、runtime 作者和工具构建者的反馈尤其有价值，因为现在的边界仍然足够小，容易推理。

请使用 [`reachjalil/harness-config`](https://github.com/reachjalil/harness-config) 仓库提出问题、issue、兼容性说明、示例和 pull request。
