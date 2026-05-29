---
title: 扩展
seoTitle: Harness config 扩展
socialTitle: Harness config 标准的扩展声明
description: 声明式扩展如何在不扩大核心资源投影 schema 的前提下添加注册行为。
socialDescription: Harness config 扩展如何声明可选行为，同时保持核心投影 schema 小。
canonicalPath: /specifications/v1/extensions/
slug: extensions
order: 3
locale: zh-cn
sectionCode: "03"
summary: 声明式扩展如何在不扩大核心资源投影 schema 的前提下添加注册行为。
llmSummary: 描述如何声明、版本化、激活、发现扩展，以及它们如何与核心 Harness config 投影模型分离。
audience: 为 Harness config 兼容工具添加可选行为的实现者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# 扩展

扩展允许工具在不扩大核心资源和 target 投影 schema 的情况下添加注册行为。基础标准定义如何发现扩展声明以及实现何时可以运行它们；每个扩展拥有自己的 schema、兼容性、诊断、计划和写入。

## 声明

扩展声明住在所选 manifest 的顶层（默认 `./.harness/harness.toml`），在 `[extensions.<id>]` 下。

```toml
[extensions.example]
version = 1
activation = "explicit"
```

核心只拥有两个字段：

- `version`：扩展自身配置 schema 的必需正整数。
- `activation`：可选；默认 `"explicit"`，或在扩展可以参与工具提供的常规激活流程时为 `"auto"`。

每个其他字段都属于扩展实现。未知扩展声明应作为仓库形状进行校验，但所选不支持的行为必须清楚失败，而不是被默默应用。

## 与核心的边界

扩展可以添加行为，但它不得重新定义 resources 源、target 映射、由 target 派生的 override、`.harnessIgnore` 语义、`.harnessMutable` 语义、`.harnessProfile` 覆盖语义、mutable 文件行为、未管理项清理或激活计划契约。

配置过的 `[[dir]]` 源是 v1 核心激活的一部分，不是扩展。它们被记录在 Standard 和 Tooling 页面，因为它们的输出与声明的 target、清理和目标输出 `.harnessIgnore` 文件直接交互。

## 实现期望

- 通过实现支持的注册表解析所选扩展。
- 在计划写入之前校验扩展自有的字段。
- 保持扩展写入对仓库本地。
- 先运行 dry-run 并在应用前显示 create、update、keep、remove 或 preserve 动作。
- 用清楚的诊断拒绝所选未知、未声明、不支持、不兼容或版本不支持的扩展。
