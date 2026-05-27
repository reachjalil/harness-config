---
title: 一致性
seoTitle: .harness 一致性
socialTitle: .harness 工具的可测试一致性声明
description: 面向仓库、资源、目标、profile、投影和工具的可测试声明。
socialDescription: 实现 .harness 标准的仓库和工具的一致性标准。
canonicalPath: /specifications/v1/conformance/
slug: conformance
order: 6
locale: zh-cn
sectionCode: "06"
summary: 面向仓库、资源、目标、profile、投影和工具的可测试声明。
llmSummary: 列出仓库形状、资源路径、目标投影、覆盖、ignore、profile、扩展和激活输出的一致性期望。
audience: 验证 .harness 兼容性的测试作者和实现者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# 一致性

Harness config 支持声明必须能从文件形状和激活合同本身测试。

## 级别

- 仓库一致性：manifest 声明 `version = 1`、仓库本地源和仓库本地目标。
- 资源一致性：资源位于配置资源源下，可以是文件、文件夹或 `.harnessComposable` 叶子；覆盖是资源内部文件夹。
- 目标一致性：每个 `[[targets]]` 只包含仓库本地路径，并且不指向 `.harness`。
- `[dir]` 一致性：`[dir]` 组合自己的 `.harnessComposable` 叶子并复制其他文件到仓库相对输出；这些输出与投影资源分开。
- 投影一致性：激活应用根、源本地、目标输出本地和 `[mutable]` 的 `.harnessIgnore`。
- 工具一致性：工具在写入前报告计划，并且从不把 harness surface 当作事实来源。

## 关键要求

实现必须保留目标输出中已经存在的 `.harnessIgnore`：不得从源投影它们，不得覆盖它们，也不得在清理未管理项时删除它们。
