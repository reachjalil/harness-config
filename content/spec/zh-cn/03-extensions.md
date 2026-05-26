---
title: 扩展
seoTitle: .harness 扩展
socialTitle: .harness 标准的扩展声明
description: 声明式扩展如何在不扩大核心投影 schema 的前提下添加注册行为。
socialDescription: .harness 扩展如何添加可选行为，同时保持核心投影 schema 小而稳定。
canonicalPath: /specifications/v1/extensions/
slug: extensions
order: 3
locale: zh-cn
sectionCode: "03"
summary: 声明式扩展如何在不扩大核心投影 schema 的前提下添加注册行为。
llmSummary: 描述扩展如何声明、版本化、激活、发现，并与核心 .harness 投影模型保持边界。
audience: 为 .harness 兼容工具添加可选行为的实现者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# 扩展

扩展允许工具添加注册行为，而不扩大核心资源和目标投影 schema。

## 声明

扩展声明位于选中 manifest 的 `[extensions.<id>]` 下。

```toml
[extensions.example]
version = 1
activation = "explicit"
```

核心只拥有 `version` 和 `activation`。其他字段属于扩展。配置中可以出现未知扩展，但被选中且不受支持的扩展必须清晰失败。

## 与核心的边界

扩展不得重新定义资源源、目标、覆盖、`.harnessIgnore`、mutable 文件或计划合同。`[dir]` 是 v1 核心表面，不是扩展。
