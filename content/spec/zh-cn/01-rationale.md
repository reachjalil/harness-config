---
title: 设计理由
seoTitle: .harness config 设计理由
socialTitle: 为什么 .harness 要分离源目录和 harness surface
description: 为什么标准要把持久源目录与实时 harness surface 分开。
socialDescription: 将 harness surface 视为生成投影，而不是规范源的设计理由。
canonicalPath: /specifications/v1/rationale/
slug: rationale
order: 1
locale: zh-cn
sectionCode: "01"
summary: 为什么标准要把持久源目录与实时 harness surface 分开。
llmSummary: 解释为什么实时 harness surface 应当是派生输出，而 .harness 保持为可审查事实来源。
audience: 正在组织跨 runtime 智能体配置的实现者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# 设计理由

Harness 需要仓库中的实时 surface。团队需要稳定、可审查的源布局，用来保存这些 harness 消费的资源。Harness config 分离这两个责任，而不规定产品应用模型。

源目录位于配置过的源根目录下，默认约定为 `./.harness`。`./.agents`、`./.claude` 和 `./.cursor` 等 harness surface 仍然是 harness 读取的实时文件或文件夹。激活把审查过的目录视图投影到这些 surface。

## 解决的问题

- 多个 harness surface 里的近似副本容易漂移。
- harness 写出的文件很难作为持久源来审查。
- 只为一个智能体禁用资源应当是投影规则，而不是手动删除。
- `AGENTS.md`、`CLAUDE.md` 等指令文件可以从可审查的 `[dir]` 源组合。
- 新智能体只要声明目标，就能消费同一个目录。

## 核心概念

- 选中的 manifest：仓库本地 TOML，默认 `./.harness/harness.toml`，声明版本、配置的源、显式目标、可选 `[dir]` 和扩展。
- 源目录：配置的资源源下的持久资源，以及配置的 dir 源下的仓库相对 `[dir]` 输出。
- 声明目标：例如 `./.agents` 或 `./.claude` 的 harness surface，只有出现在 manifest 中才接收投影。
- 目标派生覆盖：资源内部的 `.claude` 等文件夹，用于调整对应目标的文件。
- Profile overlay：由 `.harnessProfile` 选择、由 `.harnessProfileRoot` 声明，按逻辑源路径合并，不把 profile 文件夹作为普通资源投影。
- 投影边界：`.harnessIgnore`，包括根、源本地、profile 本地、目标输出本地和 `[mutable]` 规则。
- 激活投影：dry-run-first 的计划，包含 `create`、`update`、`remove`、`keep`、`preserve`、`mutable` 动作，以及显式清理和 mutable 策略。

## 非目标

`[dir]` 属于 v1 核心，不是扩展：它的输出参与投影、清理和目标输出规则。扩展只用于不重新定义源、目标、profile、ignore、mutable、清理或核心激活计划的注册行为。

该标准不规范 marketplace、托管服务、反向捕获、runtime 修改审查、选择策略、恢复状态或智能体内部行为。
