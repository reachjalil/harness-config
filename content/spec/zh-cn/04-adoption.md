---
title: 采用
seoTitle: 采用 .harness config
socialTitle: 如何在仓库中采用 .harness
description: 面向新项目、迁移、profile、可组合指令和安全清理的实践流程。
socialDescription: 将智能体配置迁移到持久 .harness 源目录的实践路径。
canonicalPath: /specifications/v1/adoption/
slug: adoption
order: 4
locale: zh-cn
sectionCode: "04"
summary: 新项目、迁移、profile、可组合指令和清理的实践流程。
llmSummary: 覆盖创建 .harness 目录、声明目标、预览激活、迁移 harness surface、使用 profile overlay 和保持目标清理安全的流程。
audience: 在新仓库或现有仓库中引入 .harness 的开发者。
contentKind: spec
status: draft
updated: 2026-05-27
---

# 采用

本指南覆盖两个路径：greenfield，也就是没有现有实时智能体文件夹；以及迁移，也就是仓库中已经有 `.claude/`、`.cursor/`、`.agents/` 或类似文件夹。

## Greenfield

1. 创建 `./.harness/harness.toml`，写入 `version = 1`。
2. 在 `.harness/resources` 或配置的资源源下添加资源。
3. 在 manifest 中显式声明每个目标。
4. 用 `.harnessIgnore` 排除只属于源的产物，用 `.harnessMutable` 标记 runtime 拥有的文件。
5. 写入前先 dry-run。

```bash
npx harnessc init
npx harnessc validate
npx harnessc explain .agents/skills/review/SKILL.md
npx harnessc activate
npx harnessc activate --yes
```

当某个源路径或输出路径需要单独检查时，使用 `npx harnessc explain <path>`。

## 迁移现有仓库

先保存当前 harness surface 的快照。然后把持久内容移到资源源，把目标差异放入 `.claude` 等覆盖文件夹，在 manifest 中声明目标，必要时用 `npx harnessc explain <path>` 检查具体路径，并在应用前审查计划。

没有变更时，第二次 dry-run 应当收敛为：受管理文件为 `keep`，runtime 拥有文件为 `mutable`。

## 常见错误

- 把实时文件夹同时当作源和目标。
- 忘记声明目标。
- 把缓存或产品状态放进 `.harness/`。
- 用覆盖来大范围分叉资源。
- 把 runtime 本地文件当作持久源提交。
