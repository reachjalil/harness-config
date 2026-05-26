---
title: 工具
seoTitle: .harness 工具
socialTitle: 验证和激活 .harness config 的工具
description: npx harnessc 实现、验证、计划、激活和清理命令。
socialDescription: 用于验证 .harness 仓库并应用激活投影的命令层。
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: zh-cn
sectionCode: "05"
summary: "npx harnessc 实现：验证、计划、激活和清理命令。"
llmSummary: 描述围绕 .harness 的验证、profile、dry-run、激活、诊断、清理和 helper 的工具期望。
audience: CLI 作者和操作 .harness 仓库的开发者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# 工具

`npx harnessc` 是用于验证、计划和激活 Harness config 的标准实现。

## 命令

```bash
npx harnessc plan
npx harnessc init
npx harnessc validate
npx harnessc activate
npx harnessc extension activate
```

`npx harnessc activate` 默认 dry-run。它会在写入前显示创建、更新、跳过的 mutable 文件、请求删除、保持不变的文件以及保留的未管理项。

默认 manifest 是 `./.harness/harness.toml`。`--config <path>` 可以选择另一个仓库本地 TOML 文件。

## `[dir]`

声明 `[dir]` 后，`.harnessComposable` 叶子会组合编号片段，其他文件会复制到仓库相对路径。源侧 `.harnessIgnore` 过滤收集过程，目标输出 `.harnessIgnore` 过滤最终结果。

## TypeScript helpers

工具可以使用 `@harnessconfig/core` 解析 TOML、加载 `.harnessIgnore`、验证仓库、计算计划并应用激活。
