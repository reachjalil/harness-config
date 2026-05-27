---
title: 模式
seoTitle: Harness config 模式与示例
socialTitle: 面向团队和开发者的 .harness 实践模式
description: 目标输出 ignore、可组合指令、profile overlay、团队 kit、个人定制和安全清理的具体示例。
socialDescription: 结合 ignore、profile、dir composition 和目标清理的 .harness 示例。
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: zh-cn
sectionCode: "07"
summary: 结合 ignore、profile、dir composition 和安全清理的具体示例。
llmSummary: 展示 Harness config 的实践模式：目标输出 ignore、可组合指令、profile overlay、团队 kit、个人定制、目标本地 profile、迁移和清理。
audience: 在真实仓库中采用 Harness config 的开发者和平台团队。
contentKind: spec
status: draft
updated: 2026-05-26
---

# Harness config 模式

本页展示如何组合标准组件，同时保持核心所有权规则：`.harness/` 是规范源，实时目标文件夹是生成输出，并带有少量受保护的本地控制。

## 针对单个输出表面的 ignore

当规则属于某个 runtime 输出子树，而不是规范源时，把 `.harnessIgnore` 放在目标输出中。

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

这会过滤 `.agents/skills/deploy-plan/` 下的最终输出，但不会影响 `.claude/skills/deploy-plan/`。

## 可组合指令

使用 `[dir]` 管理 `AGENTS.md` 等仓库文件。包含 `.harnessComposable` 的叶子会把编号片段连接成仓库相对输出：

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_intro.md
  200_rules.md
```

同一个标记位于资源源下时，会组合一个投影到每个目标中的资源文件，例如 `skills/review/SKILL.md`；这种情况仍然是资源，不是 `[dir]` 输出。

## 仓库级 profile

仓库根的 `.harnessProfile` 为整个投影选择一个层。资源下的 `.harnessProfileRoot` 可以添加或覆盖逻辑资源，而不会把 profile 文件夹自身投影出去。

## 团队 kit

一个 kit 可以从 `.harness/kits/<name>` 提供共享 skills、rules 和指令。Kit 是被审查的源；selector 决定它在哪里生效。

## 本地定制

Profile 可以添加个人指令片段，也可以按逻辑源路径排除基础片段。当团队应共享同一选择时，提交 `.harnessProfile`；当每个开发者应本地选择时，将其加入 ignore。
